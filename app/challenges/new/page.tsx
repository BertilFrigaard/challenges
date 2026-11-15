import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Spinner } from "@/app/spinner";
import { CreateChallengeForm } from "./create-challenge-form";

export const metadata: Metadata = { title: "New challenge" };

export default function NewChallengePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] font-sans sm:pt-12">
      {/* The session is read from the request cookie, so it streams in behind a boundary. */}
      <Suspense fallback={<Spinner className="mt-12 size-8 text-primary" label="Loading" />}>
        <AuthedForm />
      </Suspense>
    </main>
  );
}

async function AuthedForm() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <CreateChallengeForm />;
}
