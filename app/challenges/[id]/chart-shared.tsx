"use client";

import { useSyncExternalStore } from "react";
import { Spinner } from "@/app/spinner";
import type { Series } from "./chart-colors";

export const CHART_HEIGHT = 280;
const TOOLTIP_MAX_ROWS = 10;

const noopSubscribe = () => () => {};

// Charts measure their container and format dates in the viewer's locale, so
// they only render in the browser; the server renders a placeholder.
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ChartPlaceholder() {
  return (
    <div style={{ height: CHART_HEIGHT }} className="flex items-center justify-center">
      <Spinner className="size-8 text-primary" label="Loading chart" />
    </div>
  );
}

// Recessive axes: muted ink, small type, no axis line or tick marks.
export const axisProps = {
  stroke: "var(--chart-grid)",
  tick: { fill: "var(--chart-axis)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export function formatPoints(n: number): string {
  return n.toLocaleString();
}

// Compact axis ticks: 950, 1.2K, 3.4M.
const compactFormat = new Intl.NumberFormat(undefined, { notation: "compact" });
export function formatCompact(n: number): string {
  return compactFormat.format(n);
}

// The hover card: a title and the players sorted by points. Long lists are cut
// short; the standings below the chart always have everyone.
export function ChartTooltipCard({
  title,
  series,
  values,
}: {
  title: string;
  series: Series[];
  values: Record<string, number>;
}) {
  const rows = series
    .map((s) => ({ s, value: values[s.key] ?? 0 }))
    .sort((a, b) => b.value - a.value || Number(b.s.colored) - Number(a.s.colored));
  const shown = rows.slice(0, TOOLTIP_MAX_ROWS);
  const hidden = rows.length - shown.length;

  return (
    <div className="max-w-64 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-sm text-foreground shadow-lg">
      <p className="mb-1 font-semibold">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {shown.map(({ s, value }) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate">{s.isYou ? "You" : s.username}</span>
            <span className="font-medium tabular-nums">{formatPoints(value)}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="mt-1 text-foreground/70">+{hidden} more</p>}
    </div>
  );
}
