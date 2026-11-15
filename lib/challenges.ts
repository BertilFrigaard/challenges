import "server-only";
import { pool } from "@/lib/db";

export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 2000;
export const PARTICIPANTS_MAX = 50;
export const PERIOD_UNITS = ["week", "month"] as const;
export const PERIOD_COUNT_MAX = 12;

export type PeriodUnit = (typeof PERIOD_UNITS)[number];

// How a challenge runs: once until a fixed end, or in repeating
// calendar-aligned periods (see the challenges table in db/schema.sql).
export type ChallengeSchedule =
  | { kind: "fixed"; endsAt: Date }
  | { kind: "periodic"; unit: PeriodUnit; count: number; timeZone: string };

export type ChallengeSummary = {
  id: string;
  name: string;
  description: string;
  creatorUsername: string;
  isCreator: boolean;
  participantCount: number;
} & (
  | { kind: "fixed"; endsAt: string /* ISO 8601 */; ended: boolean }
  | { kind: "periodic"; periodUnit: PeriodUnit; periodCount: number }
);

export type UserMatch = { id: string; username: string };

// Creates the challenge and its participant rows in one transaction. The
// creator is always added as a participant; duplicates are ignored.
export async function createChallenge(input: {
  creatorId: string;
  name: string;
  description: string;
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
         (creator_id, name, description, kind, ends_at,
          period_unit, period_count, time_zone, period_anchor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text,
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

// Every challenge the user takes part in. Active ones come first: fixed ones
// ending soonest, then periodic ones (newest first), which never end. Ended
// fixed ones come last, most recently ended first.
export async function getChallengesForUser(userId: string): Promise<ChallengeSummary[]> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    description: string;
    kind: "fixed" | "periodic";
    ends_at: Date | null;
    period_unit: PeriodUnit | null;
    period_count: number | null;
    creator_username: string;
    is_creator: boolean;
    participant_count: number;
    ended: boolean;
  }>(
    `SELECT c.id, c.name, c.description, c.kind, c.ends_at,
            c.period_unit, c.period_count,
            u.username AS creator_username,
            c.creator_id = $1 AS is_creator,
            (SELECT count(*)::int FROM challenge_participants p WHERE p.challenge_id = c.id)
              AS participant_count,
            (c.kind = 'fixed' AND c.ends_at <= now()) AS ended
       FROM challenge_participants me
       JOIN challenges c ON c.id = me.challenge_id
       JOIN users u ON u.id = c.creator_id
      WHERE me.user_id = $1
      ORDER BY ended,
               CASE WHEN c.ends_at > now() THEN c.ends_at END ASC NULLS LAST,
               c.ends_at DESC,
               c.created_at DESC`,
    [userId],
  );

  return rows.map((r): ChallengeSummary => {
    const common = {
      id: r.id,
      name: r.name,
      description: r.description,
      creatorUsername: r.creator_username,
      isCreator: r.is_creator,
      participantCount: r.participant_count,
    };
    return r.kind === "fixed"
      ? { ...common, kind: "fixed", endsAt: r.ends_at!.toISOString(), ended: r.ended }
      : { ...common, kind: "periodic", periodUnit: r.period_unit!, periodCount: r.period_count! };
  });
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
