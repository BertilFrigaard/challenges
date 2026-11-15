"use server";

import { verifyCredentials } from "@/lib/auth";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { status: "idle" | "failure" | "error" };

// On success the session cookie is set and Next re-renders `/`, which then
// shows the home screen; the returned state only matters on failure.
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return { status: "failure" };
  }
  const trimmed = username.trim();
  if (!trimmed || !password) return { status: "failure" };

  try {
    const user = await verifyCredentials(trimmed, password);
    if (!user) return { status: "failure" };
    await createSession(user.id);
    return { status: "idle" };
  } catch (err) {
    console.error("Login failed:", (err as Error).message);
    return { status: "error" };
  }
}

export async function logout(): Promise<void> {
  await deleteSession();
}
