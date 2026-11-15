CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Usernames are case-insensitive: "User" and "user" are the same user.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (lower(username));
