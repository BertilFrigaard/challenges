import "server-only";
import { cookies } from "next/headers";
import { SignJWT, errors, jwtVerify } from "jose";

// Stateless session: a signed (HS256) JWT in an HttpOnly cookie.
// Claims are only sub (user id), iat and exp; the user is looked up per request.

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days, fixed (no sliding renewal)
const ALGORITHM = "HS256";

let key: Uint8Array | undefined;

function getKey(): Uint8Array {
  if (key) return key;
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  const decoded = Buffer.from(secret, "base64");
  if (decoded.length < 32) {
    throw new Error("SESSION_SECRET must be base64 of at least 32 random bytes.");
  }
  key = new Uint8Array(decoded);
  return key;
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getKey());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

// Returns the user id of a valid session, or null when there is no cookie or
// the token fails verification (bad signature, expired, malformed, wrong alg).
export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: [ALGORITHM],
      requiredClaims: ["sub", "iat", "exp"],
    });
    return payload.sub ?? null;
  } catch (err) {
    // Only token problems mean "logged out"; a missing/short secret is a
    // server misconfiguration and must surface.
    if (err instanceof errors.JOSEError) return null;
    throw err;
  }
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
