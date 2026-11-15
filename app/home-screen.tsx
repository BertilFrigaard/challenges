import Link from "next/link";
import { logout } from "@/app/actions";
import { LocalTime } from "@/app/local-time";
import { LogoutButton } from "@/app/logout-button";
import { primaryButtonClass } from "@/app/ui-classes";
import type { User } from "@/lib/auth";
import { getChallengesForUser, type ChallengeSummary } from "@/lib/challenges";

export async function HomeScreen({ user }: { user: User }) {
  const challenges = await getChallengesForUser(user.id);
  const active = challenges.filter((c) => !isEnded(c));
  const ended = challenges.filter(isEnded);

  return (
    <section className="flex w-full max-w-3xl flex-col gap-8 text-left">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="min-w-0 text-2xl font-semibold break-words sm:text-3xl">
          Signed in as <span className="text-primary">{user.username}</span>
        </h1>
        <form action={logout} className="shrink-0">
          <LogoutButton />
        </form>
      </header>

      <Link href="/challenges/new" className={`${primaryButtonClass} w-full sm:w-fit`}>
        <span aria-hidden="true" className="text-xl leading-none">
          +
        </span>
        New challenge
      </Link>

      {challenges.length === 0 ? (
        <p className="rounded-lg bg-surface px-4 py-6 text-base text-foreground/80">
          You&apos;re not in any challenges yet. Create one and invite some people.
        </p>
      ) : (
        <>
          <ChallengeSection title="Active" challenges={active} empty="No active challenges." />
          {ended.length > 0 && <ChallengeSection title="Ended" challenges={ended} />}
        </>
      )}
    </section>
  );
}

function ChallengeSection({
  title,
  challenges,
  empty,
}: {
  title: string;
  challenges: ChallengeSummary[];
  empty?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        {title} <span className="font-normal text-foreground/60">({challenges.length})</span>
      </h2>
      {challenges.length === 0 ? (
        <p className="text-base text-foreground/70">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {challenges.map((c) => (
            <li key={c.id}>
              <ChallengeCard challenge={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Periodic challenges never end.
function isEnded(c: ChallengeSummary): boolean {
  return c.kind === "fixed" && c.ended;
}

// "every week", "every 2 weeks", "every month", "every 3 months".
function periodLabel(unit: "week" | "month", count: number): string {
  return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`;
}

function ChallengeCard({ challenge: c }: { challenge: ChallengeSummary }) {
  return (
    <article
      className={`flex h-full min-w-0 flex-col gap-2 rounded-lg border border-foreground/10 bg-surface p-4 ${isEnded(c) ? "opacity-75" : ""}`}
    >
      <h3 className="min-w-0 text-base font-semibold break-words">{c.name}</h3>
      {c.description && (
        <p className="line-clamp-3 text-sm break-words whitespace-pre-line text-foreground/80">
          {c.description}
        </p>
      )}
      <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-foreground/70">
        {c.kind === "fixed" ? (
          <div className="flex gap-1">
            <dt>{c.ended ? "Ended" : "Ends"}</dt>
            <dd className="font-medium text-foreground">
              <LocalTime iso={c.endsAt} />
            </dd>
          </div>
        ) : (
          <div className="flex gap-1">
            <dt>Resets</dt>
            <dd className="font-medium text-foreground">
              {periodLabel(c.periodUnit, c.periodCount)}
            </dd>
          </div>
        )}
        <div className="flex gap-1">
          <dt className="sr-only">Participants</dt>
          <dd>
            {c.participantCount} {c.participantCount === 1 ? "participant" : "participants"}
          </dd>
        </div>
        <div className="flex min-w-0 gap-1">
          <dt>by</dt>
          <dd className="truncate">{c.isCreator ? "you" : c.creatorUsername}</dd>
        </div>
      </dl>
    </article>
  );
}
