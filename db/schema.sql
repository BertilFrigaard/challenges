CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Usernames are case-insensitive: "User" and "user" are the same user.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (lower(username));

-- A challenge is created by one user; creator_id decides who may perform
-- creator-only actions. The creator is also always a participant.
--
-- kind = 'fixed': runs once until ends_at; the highest total wins.
-- kind = 'periodic': never ends; points reset at the start of every period.
-- Periods are calendar-aligned in the creator's time_zone: a period of
-- period_count weeks starts on a Monday at 00:00, one of period_count months
-- on the 1st at 00:00. period_anchor is the local date period 1 started (the
-- Monday / 1st on or before creation, so period 1 is usually partial). Period
-- k starts at (period_anchor + k * period_count units) 00:00 in time_zone, so
-- DST and month lengths are handled by wall-clock arithmetic.
CREATE TABLE IF NOT EXISTS challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description   text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  kind          text NOT NULL CHECK (kind IN ('fixed', 'periodic')),
  ends_at       timestamptz,
  period_unit   text CHECK (period_unit IN ('week', 'month')),
  period_count  integer CHECK (period_count BETWEEN 1 AND 12),
  period_anchor date,
  time_zone     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenges_kind_fields CHECK (
    (kind = 'fixed' AND ends_at IS NOT NULL
       AND period_unit IS NULL AND period_count IS NULL
       AND period_anchor IS NULL AND time_zone IS NULL)
    OR
    (kind = 'periodic' AND ends_at IS NULL
       AND period_unit IS NOT NULL AND period_count IS NOT NULL
       AND period_anchor IS NOT NULL AND time_zone IS NOT NULL)
  ),
  CONSTRAINT challenges_anchor_aligned CHECK (
    period_unit IS NULL
    OR (period_unit = 'week'  AND extract(isodow FROM period_anchor) = 1)
    OR (period_unit = 'month' AND extract(day FROM period_anchor) = 1)
  )
);

CREATE INDEX IF NOT EXISTS challenges_creator_id_idx ON challenges (creator_id);

-- Links users to the challenges they take part in.
CREATE TABLE IF NOT EXISTS challenge_participants (
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

-- The primary key covers lookups by challenge; this covers "my challenges".
CREATE INDEX IF NOT EXISTS challenge_participants_user_id_idx ON challenge_participants (user_id);

-- Every change to a participant's points. Totals (overall, or per period for
-- periodic challenges) are sums over created_at ranges; no running total is
-- stored. Negative deltas correct earlier entries.
CREATE TABLE IF NOT EXISTS point_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  user_id      uuid NOT NULL,
  delta        integer NOT NULL CHECK (delta <> 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Only participants can have points; leaving a challenge removes them.
  FOREIGN KEY (challenge_id, user_id)
    REFERENCES challenge_participants (challenge_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS point_entries_challenge_created_idx
  ON point_entries (challenge_id, created_at);
