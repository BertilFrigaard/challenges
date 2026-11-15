"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions";
import { Spinner } from "@/app/spinner";

const messages: Record<Exclude<LoginState["status"], "idle">, string> = {
  failure: "Invalid username or password",
  error: "Something went wrong. Try again.",
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
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-background cursor-pointer transition hover:scale-98 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {pending && <Spinner className="size-5" />}
        {pending ? "Logging in…" : "Log in"}
      </button>

      <p role="status" aria-live="polite" className="min-h-6 text-base font-medium text-error">
        {message}
      </p>
    </form>
  );
}
