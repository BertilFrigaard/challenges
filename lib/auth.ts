import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { pool } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export type User = { id: string; username: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Verified against when the username doesn't exist, so a login attempt takes
// about as long either way and timing doesn't reveal which usernames exist.
let dummyHash: Promise<string> | undefined;

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<{ id: string } | null> {
  const { rows } = await pool.query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE lower(username) = lower($1)",
    [username],
  );

  if (rows.length === 0) {
    dummyHash ??= hash("not-a-real-password");
    await verify(await dummyHash, password);
    return null;
  }

  return (await verify(rows[0].password_hash, password)) ? { id: rows[0].id } : null;
}

// The logged-in user, or null when there is no valid session or the user no
// longer exists. Database errors propagate rather than reading as "logged out".
export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  // Guard the uuid cast so an unexpected sub can't make Postgres throw.
  if (!userId || !UUID_RE.test(userId)) return null;

  const { rows } = await pool.query<User>("SELECT id, username FROM users WHERE id = $1", [userId]);
  return rows[0] ?? null;
}
