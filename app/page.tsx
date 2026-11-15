import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { HomeScreen } from "./home-screen";
import { LoginForm } from "./login-form";
import { Spinner } from "./spinner";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] font-sans">
      {/* The session is read from the request cookie, so it streams in behind a boundary. */}
      <Suspense fallback={<Spinner className="size-8 text-primary" label="Loading" />}>
        <Session />
      </Suspense>
    </main>
  );
}

async function Session() {
  const user = await getCurrentUser();
  return user ? <HomeScreen username={user.username} /> : <LoginForm />;
}
