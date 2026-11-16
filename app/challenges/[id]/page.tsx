import { Suspense, cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddPointsButton, AddPointsProvider } from "@/app/add-points";
import { LocalTime } from "@/app/local-time";
import { periodLabel } from "@/app/period-label";
import { Spinner } from "@/app/spinner";
import { getCurrentUser } from "@/lib/auth";
import { getChallengeDetail, type ChallengeDetail } from "@/lib/challenges";
import { isUuid } from "@/lib/uuid";
import { assignSeries } from "./chart-colors";
import { DeleteChallenge } from "./delete-challenge";
import { PeriodChart } from "./period-chart";
import { ProgressChart } from "./progress-chart";
import { Standings } from "./standings";

// Shared by the page and its metadata, so one request reads the session and
// the challenge once.
const load = cache(async (id: string) => {
  const user = await getCurrentUser();
  const detail = user && isUuid(id) ? await getChallengeDetail(id, user.id) : null;
  return { user, detail };
});

export async function generateMetadata({ params }: PageProps<"/challenges/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { detail } = await load(id);
  return { title: detail?.name ?? "Challenge" };
}

export default function ChallengePage({ params }: PageProps<"/challenges/[id]">) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] font-sans sm:pt-12">
      {/* The params and session are only known per request, so they stream in behind a boundary. */}
      <Suspense fallback={<Spinner className="mt-12 size-8 text-primary" label="Loading" />}>
        <ChallengeView params={params} />
      </Suspense>
    </main>
  );
}

async function ChallengeView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, detail: c } = await load(id);
  if (!user) redirect("/");
  // Also when the user isn't a participant, so that doesn't reveal the challenge exists.
  if (!c) notFound();

  const scores = scoresOf(c);
  const series = assignSeries(c.participants, user.id, (userId) => scores[userId] ?? 0);
  const canAddPoints = !(c.kind === "fixed" && c.ended);

  return (
    <AddPointsProvider challenges={canAddPoints ? [{ id: c.id, name: c.name }] : []}>
      <article className="flex w-full max-w-4xl min-w-0 flex-col gap-6 text-left">
        <Link
          href="/"
          className="-ml-2 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 text-base font-medium text-foreground/80 transition hover:scale-98 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <span aria-hidden="true">←</span> All challenges
        </Link>

        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold break-words sm:text-3xl">{c.name}</h1>
          <Meta challenge={c} />
          {c.description && (
            <p className="max-w-prose text-base break-words whitespace-pre-line text-foreground/85">
              {c.description}
            </p>
          )}
        </header>

        {canAddPoints && <AddPointsButton challengeId={c.id} challengeName={c.name} variant="labeled" />}

        <section
          aria-labelledby="chart-title"
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-foreground/10 bg-surface p-3 sm:p-5"
        >
          <h2 id="chart-title" className="text-lg font-semibold">
            {c.kind === "fixed" ? "Points over time" : "Points per period"}
          </h2>
          {c.kind === "fixed" ? (
            <ProgressChart
              series={series}
              runningTotals={c.runningTotals}
              startsAt={c.createdAt}
              endsAt={c.ended ? c.endsAt : c.now}
            />
          ) : (
            <PeriodChart series={series} periods={c.periods} periodUnit={c.periodUnit} timeZone={c.timeZone} />
          )}
        </section>

        <Standings
          series={series}
          scores={scores}
          caption={c.kind === "periodic" ? "this period" : c.ended ? "final" : "total"}
        />

        {c.isCreator && (
          <section
            aria-labelledby="delete-section-title"
            className="mt-4 flex flex-col gap-3 border-t border-foreground/10 pt-6"
          >
            <h2 id="delete-section-title" className="text-lg font-semibold">
              Delete challenge
            </h2>
            <p className="text-base text-foreground/80">
              As the creator, you can delete this challenge with all its points, for everyone.
            </p>
            <DeleteChallenge challengeId={c.id} challengeName={c.name} />
          </section>
        )}
      </article>
    </AddPointsProvider>
  );
}

// Points per user that the standings rank by: the total for a fixed challenge,
// the current period's points for a periodic one.
function scoresOf(c: ChallengeDetail): Record<string, number> {
  if (c.kind === "periodic") return c.periods.at(-1)?.totals ?? {};
  const scores: Record<string, number> = {};
  for (const t of c.runningTotals) scores[t.userId] = t.total;
  return scores;
}

function Meta({ challenge: c }: { challenge: ChallengeDetail }) {
  const current = c.kind === "periodic" ? c.periods.at(-1) : undefined;
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-base text-foreground/70">
      {c.kind === "fixed" ? (
        <div className="flex gap-1">
          <dt>{c.ended ? "Ended" : "Ends"}</dt>
          <dd className="font-medium text-foreground">
            <LocalTime iso={c.endsAt} />
          </dd>
        </div>
      ) : (
        <>
          <div className="flex gap-1">
            <dt>Resets</dt>
            <dd className="font-medium text-foreground">{periodLabel(c.periodUnit, c.periodCount)}</dd>
          </div>
          {current && (
            <div className="flex gap-1">
              <dt>Next reset</dt>
              <dd className="font-medium text-foreground">
                <LocalTime iso={current.endsAt} />
              </dd>
            </div>
          )}
        </>
      )}
      <div className="flex gap-1">
        <dt className="sr-only">Participants</dt>
        <dd>
          {c.participants.length} {c.participants.length === 1 ? "participant" : "participants"}
        </dd>
      </div>
      <div className="flex min-w-0 gap-1">
        <dt>by</dt>
        <dd className="truncate">{c.isCreator ? "you" : c.creatorUsername}</dd>
      </div>
    </dl>
  );
}
