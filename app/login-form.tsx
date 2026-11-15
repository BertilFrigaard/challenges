"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions";

const messages: Record<Exclude<LoginState["status"], "idle">, { text: string; color: string }> = {
  success: { text: "Success", color: "text-success" },
  failure: { text: "Invalid username or password", color: "text-error" },
  error: { text: "Something went wrong. Try again.", color: "text-error" },
};

const inputClass =
  "min-h-11 w-full rounded-lg border border-foreground/20 bg-surface px-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/40";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, { status: "idle" });
  const message = state.status === "idle" ? null : messages[state.status];

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4 text-left">
      <h1 className="text-2xl font-semibold sm:text-3xl">Log in</h1>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Username</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 min-h-11 w-full rounded-lg bg-primary px-4 text-base font-semibold text-background transition-opacity disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>

      <p role="status" aria-live="polite" className={`min-h-6 text-base font-medium ${message?.color ?? ""}`}>
        {message?.text}
      </p>
    </form>
  );
}
