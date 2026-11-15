"use server";

import { verifyCredentials } from "@/lib/auth";

export type LoginState = { status: "idle" | "success" | "failure" | "error" };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return { status: "failure" };
  }
  const trimmed = username.trim();
  if (!trimmed || !password) return { status: "failure" };

  try {
    return { status: (await verifyCredentials(trimmed, password)) ? "success" : "failure" };
  } catch (err) {
    console.error("Login failed:", (err as Error).message);
    return { status: "error" };
  }
}
