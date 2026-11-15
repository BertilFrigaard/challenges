import { logout } from "@/app/actions";
import { LogoutButton } from "@/app/logout-button";

export function HomeScreen({ username }: { username: string }) {
  return (
    <section className="flex w-full max-w-sm flex-col gap-6 text-left">
      <h1 className="text-2xl font-semibold break-words sm:text-3xl">
        Signed in as <span className="text-primary">{username}</span>
      </h1>
      <form action={logout}>
        <LogoutButton />
      </form>
    </section>
  );
}
