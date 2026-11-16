"use client";

import { useLayoutEffect, useRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PeriodTotals, PeriodUnit } from "@/lib/challenges";
import type { Series } from "./chart-colors";
import {
  CHART_HEIGHT,
  ChartPlaceholder,
  ChartTooltipCard,
  axisProps,
  formatCompact,
  useMounted,
} from "./chart-shared";

// Horizontal room per bar and per period group, so many players or many
// periods make the chart scroll inside its box instead of squeezing bars.
const BAR_SLOT_PX = 10;
const GROUP_PADDING_PX = 28;
const GROUP_MIN_PX = 64;
const Y_AXIS_PX = 44;
const PAST_OPACITY = 0.55;

// `k` is the period's index; the rest are series keys with that player's points.
type Row = Record<string, number>;

// One bar per player per period. The current period (always the last one) is
// shaded and labeled, and earlier ones are muted. The chart opens scrolled to
// the current period, with the y-axis on the right so it stays in view there.
export function PeriodChart({
  series,
  periods,
  periodUnit,
  timeZone,
}: {
  series: Series[];
  periods: PeriodTotals[];
  periodUnit: PeriodUnit;
  timeZone: string;
}) {
  const mounted = useMounted();
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [mounted, periods.length]);

  if (!mounted) return <ChartPlaceholder />;

  const current = periods.length - 1;
  const rows: Row[] = periods.map((p, k) => ({
    k,
    ...Object.fromEntries(series.map((s) => [s.key, p.totals[s.id] ?? 0])),
  }));
  const groupPx = Math.max(GROUP_MIN_PX, series.length * BAR_SLOT_PX + GROUP_PADDING_PX);
  const minWidth = periods.length * groupPx + Y_AXIS_PX;

  const tickFormat = new Intl.DateTimeFormat(
    undefined,
    periodUnit === "week" ? { month: "short", day: "numeric", timeZone } : { month: "short", year: "2-digit", timeZone },
  );
  const rangeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone });
  // Periods end at the next one's start; the last day shown is the day before.
  const rangeLabel = (p: PeriodTotals) =>
    rangeFormat.formatRange(new Date(p.startsAt), new Date(Date.parse(p.endsAt) - 1));

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      role="img"
      aria-label="Bar chart of each player's points per period. The current period is the last one. The standings below list the current period's points."
      className="overflow-x-auto overscroll-x-contain rounded-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
    >
      {/* Clipped because the chart measures its width rounded up; a fraction of
          a pixel would otherwise show a scrollbar when everything fits. */}
      <div style={{ minWidth }} className="overflow-hidden">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={rows} barGap={2} barCategoryGap={12} margin={{ top: 24, right: 0, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <ReferenceArea
              x1={current}
              x2={current}
              fill="var(--foreground)"
              fillOpacity={0.07}
              ifOverflow="visible"
              label={{ value: "Current", position: "top", fill: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
            />
            <XAxis
              {...axisProps}
              dataKey="k"
              type="category"
              interval={0}
              tickFormatter={(k: number) => {
                const p = periods[k];
                return p ? tickFormat.format(new Date(p.startsAt)) : "";
              }}
            />
            <YAxis
              {...axisProps}
              orientation="right"
              allowDecimals={false}
              width={Y_AXIS_PX}
              tickFormatter={formatCompact}
            />
            <Tooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }}
              isAnimationActive={false}
              content={({ active, payload, label }) => {
                const p = periods[Number(label)];
                if (!active || !payload?.length || !p) return null;
                const title = Number(label) === current ? `${rangeLabel(p)} (current)` : rangeLabel(p);
                return <ChartTooltipCard title={title} series={series} values={payload[0].payload as Row} />;
              }}
            />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.username}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                isAnimationActive={false}
              >
                {rows.map((_, k) => (
                  <Cell key={k} fillOpacity={k === current ? 1 : PAST_OPACITY} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
