"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions";
import { Spinner } from "@/app/spinner";
import { inputClass, primaryButtonClass } from "@/app/ui-classes";

const messages: Record<Exclude<LoginState["status"], "idle">, string> = {
  failure: "Invalid username or password",
  error: "Something went wrong. Try again.",
};

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
        className={`${primaryButtonClass} mt-2 w-full`}
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
