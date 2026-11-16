import type { Participant } from "@/lib/challenges";

// Only this many colors stay distinguishable (also for colorblind viewers);
// see --series-1..8 in app/globals.css.
const SERIES_SLOTS = 8;
export const OTHER_COLOR = "var(--series-other)";

// A participant as charted: `key` is a stable data key for the chart rows
// (user ids aren't safe as Recharts data keys) and `color` is a CSS color.
export type Series = Participant & { key: string; color: string; isYou: boolean; colored: boolean };

// The viewer gets the first color, the next seven by `score` (highest first,
// then by name) get the rest in slot order, and everyone else is gray. Colors
// follow the person, so a chart can draw them in any order.
export function assignSeries(
  participants: Participant[],
  youId: string,
  score: (userId: string) => number,
): Series[] {
  const others = participants
    .filter((p) => p.id !== youId)
    .sort((a, b) => score(b.id) - score(a.id) || a.username.localeCompare(b.username));
  const ranked = [...participants.filter((p) => p.id === youId), ...others];
  const slotOf = new Map(ranked.slice(0, SERIES_SLOTS).map((p, i) => [p.id, i + 1]));

  return participants.map((p, i) => {
    const slot = slotOf.get(p.id);
    return {
      ...p,
      key: `p${i}`,
      color: slot ? `var(--series-${slot})` : OTHER_COLOR,
      isYou: p.id === youId,
      colored: slot !== undefined,
    };
  });
}
