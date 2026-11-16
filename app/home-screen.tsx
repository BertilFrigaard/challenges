import Link from "next/link";
import { logout } from "@/app/actions";
import { AddPointsButton, AddPointsProvider } from "@/app/add-points";
import { Countdown } from "@/app/countdown";
import { LocalTime } from "@/app/local-time";
import { LogoutButton } from "@/app/logout-button";
import { formatAmount } from "@/app/point-unit";
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
        <AddPointsProvider challenges={active.map(({ id, name, unit }) => ({ id, name, unit }))}>
          <ChallengeSection title="Active" challenges={active} empty="No active challenges." />
          {ended.length > 0 && <ChallengeSection title="Ended" challenges={ended} />}
        </AddPointsProvider>
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

function ChallengeCard({ challenge: c }: { challenge: ChallengeSummary }) {
  return (
    <article
      className={`relative flex h-full min-w-0 cursor-pointer flex-col gap-2 rounded-lg border border-foreground/10 bg-surface p-4 transition hover:scale-98 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary/40 ${isEnded(c) ? "opacity-75" : ""}`}
    >
      <div className="flex items-start gap-3">
        <h3 className="min-w-0 flex-1 text-base font-semibold break-words">
          {/* Stretched over the whole card, so the card is the link; the add
              button sits above it. */}
          <Link
            href={`/challenges/${c.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-lg"
          >
            {c.name}
          </Link>
        </h3>
        {!isEnded(c) && <AddPointsButton challengeId={c.id} challengeName={c.name} unit={c.unit} />}
      </div>
      <p className="text-base font-semibold break-words tabular-nums">{standingText(c)}</p>
      <p className="mt-auto pt-1 text-sm text-foreground/70">
        {c.kind === "periodic" ? (
          <>
            Resets in{" "}
            <span className="font-medium text-foreground">
              <Countdown to={c.periodEndsAt} />
            </span>
          </>
        ) : c.ended ? (
          <>
            Ended{" "}
            <span className="font-medium text-foreground">
              <LocalTime iso={c.endsAt} />
            </span>
          </>
        ) : (
          <>
            Ends in{" "}
            <span className="font-medium text-foreground">
              <Countdown to={c.endsAt} />
            </span>
          </>
        )}
      </p>
    </article>
  );
}

// "Tied 2nd of 5 · 120 minutes", or "Finished 2nd of 5 · 120 minutes" once ended.
function standingText(c: ChallengeSummary): string {
  const ended = isEnded(c);
  if (!c.anyoneScored) return ended ? `No ${c.unit.plural} scored` : `No ${c.unit.plural} yet`;
  const tied = c.tied ? (ended ? "tied " : "Tied ") : "";
  const amount = formatAmount(c.myPoints, c.unit);
  return `${ended ? "Finished " : ""}${tied}${ordinal(c.place)} of ${c.participantCount} · ${amount}`;
}

// 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st…
function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return n + (["th", "st", "nd", "rd"][n % 10] ?? "th");
}
