import { unitWord } from "@/app/point-unit";
import type { PointUnit } from "@/lib/challenges";
import type { Series } from "./chart-colors";

// Everyone ranked by score (ties share a rank). Doubles as the chart's
// legend, via the color swatches, and as its accessible table view.
export function Standings({
  series,
  scores,
  unit,
  caption,
}: {
  series: Series[];
  scores: Record<string, number>;
  unit: PointUnit;
  caption: string;
}) {
  const sorted = [...series].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || a.username.localeCompare(b.username),
  );
  // Ties share a rank: 1, 2, 2, 4.
  const ranked = sorted.map((s) => ({ s, score: scores[s.id] ?? 0 }));
  const ranks = ranked.map(({ score }) => ranked.findIndex((r) => r.score === score) + 1);

  return (
    <section aria-labelledby="standings-title" className="flex flex-col gap-2">
      <h2 id="standings-title" className="text-lg font-semibold">
        Standings <span className="text-base font-normal text-foreground/70">· {caption}</span>
      </h2>
      <ol className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {ranked.map(({ s, score }, i) => {
          const rank = ranks[i];
          return (
            <li
              key={s.id}
              className={`flex min-h-11 items-center gap-3 border-b border-foreground/10 px-1 text-base ${s.isYou ? "font-semibold" : ""}`}
            >
              <span className="w-7 shrink-0 text-right text-foreground/70 tabular-nums">{rank}.</span>
              <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate">
                {s.username}
                {s.isYou && <span className="font-normal text-foreground/70"> (you)</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {score.toLocaleString("en-US")} <span className="sr-only">{unitWord(score, unit)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
