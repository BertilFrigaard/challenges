import { hash, verify } from "@node-rs/argon2";
import { pool } from "@/lib/db";

// Verified against when the username doesn't exist, so a login attempt takes
// about as long either way and timing doesn't reveal which usernames exist.
let dummyHash: Promise<string> | undefined;

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const { rows } = await pool.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE lower(username) = lower($1)",
    [username],
  );

  if (rows.length === 0) {
    dummyHash ??= hash("not-a-real-password");
    await verify(await dummyHash, password);
    return false;
  }

  return verify(rows[0].password_hash, password);
}
