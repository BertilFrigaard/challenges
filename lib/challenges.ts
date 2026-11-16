import "server-only";
import { pool } from "@/lib/db";

export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 2000;
export const PARTICIPANTS_MAX = 50;
export const PERIOD_UNITS = ["week", "month"] as const;
export const PERIOD_COUNT_MAX = 12;
export const POINTS_MAX = 1_000_000;
export const UNIT_MAX = 20;

export type PeriodUnit = (typeof PERIOD_UNITS)[number];

// What a challenge counts, lowercase, e.g. minute / minutes.
export type PointUnit = { singular: string; plural: string };
export const DEFAULT_UNIT: PointUnit = { singular: "point", plural: "points" };

// How a challenge runs: once until a fixed end, or in repeating
// calendar-aligned periods (see the challenges table in db/schema.sql).
export type ChallengeSchedule =
  | { kind: "fixed"; endsAt: Date }
  | { kind: "periodic"; unit: PeriodUnit; count: number; timeZone: string };

// A challenge as listed on the home screen, with how the user stands in it:
// overall for a fixed challenge, in the current period for a periodic one.
export type ChallengeSummary = {
  id: string;
  name: string;
  unit: PointUnit;
  participantCount: number;
  myPoints: number;
  // Ties share a place (1, 2, 2, 4), like the standings on the challenge page.
  place: number;
  tied: boolean;
  // False while every participant is still at 0 points.
  anyoneScored: boolean;
} & (
  | { kind: "fixed"; endsAt: string /* ISO 8601 */; ended: boolean }
  | { kind: "periodic"; periodEndsAt: string /* ISO 8601 */ }
);

export type UserMatch = { id: string; username: string };

export type Participant = { id: string; username: string };

// A participant's running total right after one of their point entries.
export type RunningTotal = { userId: string; at: string /* ISO 8601 */; total: number };

// One period of a periodic challenge: [startsAt, endsAt), with each
// participant's points in it (participants without points are left out).
export type PeriodTotals = {
  startsAt: string /* ISO 8601 */;
  endsAt: string /* ISO 8601 */;
  totals: Record<string, number>;
};

export type ChallengeDetail = {
  id: string;
  name: string;
  description: string;
  unit: PointUnit;
  creatorUsername: string;
  isCreator: boolean;
  createdAt: string /* ISO 8601 */;
  // The database's clock when the detail was read, so charts end at the same
  // instant the totals were summed up to.
  now: string /* ISO 8601 */;
  participants: Participant[];
} & (
  | { kind: "fixed"; endsAt: string /* ISO 8601 */; ended: boolean; runningTotals: RunningTotal[] }
  | {
      kind: "periodic";
      periodUnit: PeriodUnit;
      periodCount: number;
      timeZone: string;
      // Oldest first; the last one is the current period.
      periods: PeriodTotals[];
    }
);

// Creates the challenge and its participant rows in one transaction. The
// creator is always added as a participant; duplicates are ignored.
export async function createChallenge(input: {
  creatorId: string;
  name: string;
  description: string;
  unit: PointUnit;
  schedule: ChallengeSchedule;
  participantIds: string[];
}): Promise<string> {
  const participantIds = [...new Set([input.creatorId, ...input.participantIds])];
  const s = input.schedule;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // A periodic challenge's anchor is the start of the current calendar
    // week (ISO, so Monday) or month in the creator's zone, computed here so
    // it is always aligned.
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO challenges
         (creator_id, name, description, unit_singular, unit_plural, kind, ends_at,
          period_unit, period_count, time_zone, period_anchor)
       VALUES ($1, $2, $3, $9, $10, $4, $5, $6, $7, $8::text,
               date_trunc($6, now() AT TIME ZONE $8::text)::date)
       RETURNING id`,
      [
        input.creatorId,
        input.name,
        input.description,
        s.kind,
        s.kind === "fixed" ? s.endsAt : null,
        s.kind === "periodic" ? s.unit : null,
        s.kind === "periodic" ? s.count : null,
        s.kind === "periodic" ? s.timeZone : null,
        input.unit.singular,
        input.unit.plural,
      ],
    );
    const challengeId = rows[0].id;
    await client.query(
      `INSERT INTO challenge_participants (challenge_id, user_id)
       SELECT $1, unnest($2::uuid[])`,
      [challengeId, participantIds],
    );
    await client.query("COMMIT");
    return challengeId;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// SQL for the index k of the period containing now, for a periodic challenge
// row aliased `c`. Period k starts at (period_anchor + k * period_count units)
// 00:00 in the challenge's time zone (see db/schema.sql).
function currentPeriodIndexSql(c: string): string {
  const today = `(now() AT TIME ZONE ${c}.time_zone)::date`;
  return `GREATEST(0, CASE ${c}.period_unit
            WHEN 'week' THEN floor((${today} - ${c}.period_anchor) / (7.0 * ${c}.period_count))
            ELSE floor(((extract(year FROM ${today}) - extract(year FROM ${c}.period_anchor)) * 12
                        + extract(month FROM ${today}) - extract(month FROM ${c}.period_anchor))
                       / ${c}.period_count)
          END)::int`;
}

// SQL for the instant period `k` (an SQL expression) of challenge row `c` starts.
function periodStartSql(c: string, k: string): string {
  return `((${c}.period_anchor + CASE ${c}.period_unit
             WHEN 'week' THEN make_interval(weeks => (${k}) * ${c}.period_count)
             ELSE make_interval(months => (${k}) * ${c}.period_count)
           END) AT TIME ZONE ${c}.time_zone)`;
}

// Every challenge the user takes part in, with their points and place. Active
// ones come first: fixed ones ending soonest, then periodic ones (newest
// first), which never end. Ended fixed ones come last, most recently ended
// first.
export async function getChallengesForUser(userId: string): Promise<ChallengeSummary[]> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    unit_singular: string;
    unit_plural: string;
    kind: "fixed" | "periodic";
    ends_at: Date | null;
    period_end: Date | null;
    ended: boolean;
    my_points: number;
    place: number;
    tied: boolean;
    participant_count: number;
    anyone_scored: boolean;
  }>(
    // Points count up to the end of a fixed challenge (as in getRunningTotals),
    // or within the current period of a periodic one. Every participant is
    // ranked, including those without points.
    `WITH mine AS (
       SELECT c.id, c.name, c.unit_singular, c.unit_plural, c.kind, c.ends_at, c.created_at,
              (c.kind = 'fixed' AND c.ends_at <= now()) AS ended,
              w.period_start, w.period_end
         FROM challenge_participants me
         JOIN challenges c ON c.id = me.challenge_id
         -- The current period; no row (so nulls) for a fixed challenge.
         LEFT JOIN LATERAL (
           SELECT ${periodStartSql("c", "cur.k")} AS period_start,
                  ${periodStartSql("c", "cur.k + 1")} AS period_end
             FROM (SELECT ${currentPeriodIndexSql("c")} AS k) cur
            WHERE c.kind = 'periodic'
         ) w ON true
        WHERE me.user_id = $1
     ),
     scores AS (
       SELECT m.id AS challenge_id, p.user_id, COALESCE(sum(e.delta), 0)::float8 AS total
         FROM mine m
         JOIN challenge_participants p ON p.challenge_id = m.id
         LEFT JOIN point_entries e
           ON e.challenge_id = p.challenge_id AND e.user_id = p.user_id
          AND CASE m.kind
                WHEN 'fixed' THEN e.created_at <= LEAST(now(), m.ends_at)
                ELSE e.created_at >= m.period_start AND e.created_at < m.period_end
              END
        GROUP BY m.id, p.user_id
     ),
     ranked AS (
       SELECT challenge_id, user_id, total,
              rank() OVER (PARTITION BY challenge_id ORDER BY total DESC)::int AS place,
              count(*) OVER (PARTITION BY challenge_id, total) > 1 AS tied,
              count(*) OVER (PARTITION BY challenge_id)::int AS participant_count,
              bool_or(total <> 0) OVER (PARTITION BY challenge_id) AS anyone_scored
         FROM scores
     )
     SELECT m.id, m.name, m.unit_singular, m.unit_plural, m.kind, m.ends_at, m.period_end, m.ended,
            r.total AS my_points, r.place, r.tied, r.participant_count, r.anyone_scored
       FROM mine m
       JOIN ranked r ON r.challenge_id = m.id AND r.user_id = $1
      ORDER BY m.ended,
               CASE WHEN m.ends_at > now() THEN m.ends_at END ASC NULLS LAST,
               m.ends_at DESC,
               m.created_at DESC`,
    [userId],
  );

  return rows.map((r): ChallengeSummary => {
    const common = {
      id: r.id,
      name: r.name,
      unit: { singular: r.unit_singular, plural: r.unit_plural },
      participantCount: r.participant_count,
      myPoints: r.my_points,
      place: r.place,
      tied: r.tied,
      anyoneScored: r.anyone_scored,
    };
    return r.kind === "fixed"
      ? { ...common, kind: "fixed", endsAt: r.ends_at!.toISOString(), ended: r.ended }
      : { ...common, kind: "periodic", periodEndsAt: r.period_end!.toISOString() };
  });
}

// The challenge as seen by one of its participants, with what its chart needs.
// Null when the challenge doesn't exist or the user doesn't take part in it.
export async function getChallengeDetail(
  challengeId: string,
  userId: string,
): Promise<ChallengeDetail | null> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    description: string;
    unit_singular: string;
    unit_plural: string;
    kind: "fixed" | "periodic";
    ends_at: Date | null;
    period_unit: PeriodUnit | null;
    period_count: number | null;
    time_zone: string | null;
    created_at: Date;
    creator_username: string;
    is_creator: boolean;
    ended: boolean;
    now: Date;
  }>(
    `SELECT c.id, c.name, c.description, c.unit_singular, c.unit_plural, c.kind, c.ends_at,
            c.period_unit, c.period_count, c.time_zone, c.created_at,
            u.username AS creator_username,
            c.creator_id = $2 AS is_creator,
            (c.kind = 'fixed' AND c.ends_at <= now()) AS ended,
            now() AS now
       FROM challenges c
       JOIN challenge_participants me ON me.challenge_id = c.id AND me.user_id = $2
       JOIN users u ON u.id = c.creator_id
      WHERE c.id = $1`,
    [challengeId, userId],
  );
  const c = rows[0];
  if (!c) return null;

  const participantsQuery = pool.query<Participant>(
    `SELECT u.id, u.username
       FROM challenge_participants p
       JOIN users u ON u.id = p.user_id
      WHERE p.challenge_id = $1
      ORDER BY lower(u.username)`,
    [challengeId],
  );

  const common = {
    id: c.id,
    name: c.name,
    description: c.description,
    unit: { singular: c.unit_singular, plural: c.unit_plural },
    creatorUsername: c.creator_username,
    isCreator: c.is_creator,
    createdAt: c.created_at.toISOString(),
    now: c.now.toISOString(),
  };

  if (c.kind === "fixed") {
    const [participants, runningTotals] = await Promise.all([
      participantsQuery,
      getRunningTotals(challengeId, c.ends_at!),
    ]);
    return {
      ...common,
      participants: participants.rows,
      kind: "fixed",
      endsAt: c.ends_at!.toISOString(),
      ended: c.ended,
      runningTotals,
    };
  }

  const [participants, periods] = await Promise.all([participantsQuery, getPeriodTotals(challengeId)]);
  return {
    ...common,
    participants: participants.rows,
    kind: "periodic",
    periodUnit: c.period_unit!,
    periodCount: c.period_count!,
    timeZone: c.time_zone!,
    periods,
  };
}

// Every point entry up to the end of a fixed challenge, as running totals per
// participant, oldest first.
async function getRunningTotals(challengeId: string, endsAt: Date): Promise<RunningTotal[]> {
  const { rows } = await pool.query<{ user_id: string; created_at: Date; total: number }>(
    `SELECT user_id, created_at,
            sum(delta) OVER (PARTITION BY user_id ORDER BY created_at, id)::float8 AS total
       FROM point_entries
      WHERE challenge_id = $1 AND created_at <= LEAST(now(), $2)
      ORDER BY created_at, id`,
    [challengeId, endsAt],
  );
  return rows.map((r) => ({ userId: r.user_id, at: r.created_at.toISOString(), total: r.total }));
}

// Each period of a periodic challenge from the first to the current one (the
// one containing now), with the points per participant in it.
async function getPeriodTotals(challengeId: string): Promise<PeriodTotals[]> {
  const { rows } = await pool.query<{
    k: number;
    starts_at: Date;
    ends_at: Date;
    user_id: string | null;
    total: number | null;
  }>(
    `WITH c AS (
       SELECT period_anchor, period_unit, period_count, time_zone
         FROM challenges
        WHERE id = $1
     ),
     cur AS (
       SELECT ${currentPeriodIndexSql("c")} AS current_k FROM c
     ),
     periods AS (
       SELECT k,
              ${periodStartSql("c", "k")} AS starts_at,
              ${periodStartSql("c", "k + 1")} AS ends_at
         FROM c, cur, generate_series(0, cur.current_k) AS s(k)
     )
     SELECT p.k, p.starts_at, p.ends_at, e.user_id, sum(e.delta)::float8 AS total
       FROM periods p
       LEFT JOIN point_entries e
         ON e.challenge_id = $1 AND e.created_at >= p.starts_at AND e.created_at < p.ends_at
      GROUP BY p.k, p.starts_at, p.ends_at, e.user_id
      ORDER BY p.k`,
    [challengeId],
  );

  const periods: PeriodTotals[] = [];
  for (const r of rows) {
    let period = periods[r.k];
    if (!period) {
      period = periods[r.k] = {
        startsAt: r.starts_at.toISOString(),
        endsAt: r.ends_at.toISOString(),
        totals: {},
      };
    }
    if (r.user_id !== null && r.total !== null) period.totals[r.user_id] = r.total;
  }
  return periods;
}

// Deletes the challenge, with its participants and points, if the user created
// it. Returns false when nothing was deleted.
export async function deleteChallenge(input: { challengeId: string; userId: string }): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM challenges WHERE id = $1 AND creator_id = $2", [
    input.challengeId,
    input.userId,
  ]);
  return rowCount === 1;
}

// Records a point entry for the user. Returns false, inserting nothing, when
// the user isn't a participant or the challenge has ended.
export async function addPointEntry(input: {
  userId: string;
  challengeId: string;
  delta: number;
}): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO point_entries (challenge_id, user_id, delta)
     SELECT c.id, p.user_id, $3
       FROM challenges c
       JOIN challenge_participants p ON p.challenge_id = c.id AND p.user_id = $2
      WHERE c.id = $1 AND NOT (c.kind = 'fixed' AND c.ends_at <= now())`,
    [input.challengeId, input.userId, input.delta],
  );
  return rowCount === 1;
}

// Users whose username starts with `query` (case-insensitive), excluding the
// searching user, who is always part of their own challenges anyway.
export async function searchUsers(query: string, excludeUserId: string): Promise<UserMatch[]> {
  const pattern = query.replace(/[\\%_]/g, (c) => `\\${c}`) + "%";
  const { rows } = await pool.query<UserMatch>(
    `SELECT id, username FROM users
      WHERE lower(username) LIKE lower($1) AND id <> $2
      ORDER BY lower(username)
      LIMIT 10`,
    [pattern, excludeUserId],
  );
  return rows;
}

// Of the given ids, the ones that belong to existing users.
export async function existingUserIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE id = ANY($1::uuid[])",
    [ids],
  );
  return rows.map((r) => r.id);
}
