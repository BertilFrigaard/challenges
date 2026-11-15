"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/app/spinner";
import { primaryButtonClass } from "@/app/ui-classes";

export function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${primaryButtonClass} w-full sm:w-auto`}
    >
      {pending && <Spinner className="size-5" />}
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
