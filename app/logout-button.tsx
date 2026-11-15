"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/app/spinner";

export function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-background cursor-pointer transition hover:scale-98 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:w-auto"
    >
      {pending && <Spinner className="size-5" />}
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
