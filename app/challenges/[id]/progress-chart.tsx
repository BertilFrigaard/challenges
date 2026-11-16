"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PointUnit, RunningTotal } from "@/lib/challenges";
import type { Series } from "./chart-colors";
import {
  CHART_HEIGHT,
  ChartPlaceholder,
  ChartTooltipCard,
  axisProps,
  formatCompact,
  useMounted,
} from "./chart-shared";

const DAY_MS = 24 * 60 * 60 * 1000;
// Recharts only labels the ends of a time domain on its own; minTickGap
// drops whichever of these don't fit on narrow screens.
const X_TICK_COUNT = 6;

// One row per instant someone's total changed: `t` (epoch ms) plus every
// series key with that player's total at that moment.
type Row = Record<string, number>;

// Each player's running total over a fixed challenge, from its start to now
// (or to its end once it has ended), as step lines: totals jump when points
// are added and stay flat in between.
export function ProgressChart({
  series,
  unit,
  runningTotals,
  startsAt,
  endsAt,
}: {
  series: Series[];
  unit: PointUnit;
  runningTotals: RunningTotal[];
  startsAt: string;
  endsAt: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <ChartPlaceholder />;

  const start = Date.parse(startsAt);
  // A brand-new challenge would otherwise have an empty time range.
  const end = Math.max(Date.parse(endsAt), start + 60_000);
  const rows = buildRows(series, runningTotals, start, end);
  const tickFormat = tickFormatter(end - start);
  // Gray lines first so the colored ones are drawn on top, and yours last.
  const drawOrder = [...series].sort(
    (a, b) => Number(a.colored) - Number(b.colored) || Number(a.isYou) - Number(b.isYou),
  );

  return (
    <div
      role="img"
      aria-label={`Line chart of each player's total ${unit.plural} over time. The standings below list the same totals.`}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            {...axisProps}
            dataKey="t"
            type="number"
            scale="time"
            domain={[start, end]}
            ticks={evenTicks(start, end, X_TICK_COUNT)}
            tickFormatter={tickFormat}
            minTickGap={24}
          />
          <YAxis {...axisProps} allowDecimals={false} width={44} tickFormatter={formatCompact} />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1, strokeDasharray: "4 4" }}
            isAnimationActive={false}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltipCard
                  title={fullFormat.format(Number(label))}
                  series={series}
                  values={payload[0].payload as Row}
                />
              ) : null
            }
          />
          {drawOrder.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.username}
              type="stepAfter"
              stroke={s.color}
              strokeWidth={s.colored ? 2 : 1.5}
              dot={false}
              activeDot={s.colored ? { r: 4, strokeWidth: 2, stroke: "var(--surface)" } : false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildRows(series: Series[], runningTotals: RunningTotal[], start: number, end: number): Row[] {
  const keyOf = new Map(series.map((s) => [s.id, s.key]));
  const rows: Row[] = [{ t: start, ...Object.fromEntries(series.map((s) => [s.key, 0])) }];
  for (const entry of runningTotals) {
    const key = keyOf.get(entry.userId);
    if (!key) continue;
    const t = Math.max(Date.parse(entry.at), start);
    let row = rows[rows.length - 1];
    if (row.t !== t) {
      row = { ...row, t };
      rows.push(row);
    }
    row[key] = entry.total;
  }
  // Carry everyone's latest total to the right edge.
  const last = rows[rows.length - 1];
  if (last.t < end) rows.push({ ...last, t: end });
  return rows;
}

const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayTimeFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric" });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" });

// Tick labels precise enough that neighbouring ticks differ: clock times
// within a day, weekday and hour within a week, then dates, then months.
function tickFormatter(spanMs: number): (t: number) => string {
  const format =
    spanMs < DAY_MS
      ? timeFormat
      : spanMs < 7 * DAY_MS
        ? dayTimeFormat
        : spanMs < 365 * DAY_MS
          ? dayFormat
          : monthFormat;
  return (t) => format.format(t);
}

function evenTicks(start: number, end: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(start + ((end - start) * i) / (count - 1)));
}
