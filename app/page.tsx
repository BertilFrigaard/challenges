import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { HomeScreen } from "./home-screen";
import { LoginForm } from "./login-form";
import { Spinner } from "./spinner";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] font-sans sm:pt-12">
      {/* The session is read from the request cookie, so it streams in behind a boundary. */}
      <Suspense
        fallback={
          <div className="flex flex-1 items-center">
            <Spinner className="size-8 text-primary" label="Loading" />
          </div>
        }
      >
        <Session />
      </Suspense>
    </main>
  );
}

async function Session() {
  const user = await getCurrentUser();
  if (user) return <HomeScreen user={user} />;
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      <LoginForm />
    </div>
  );
}
