// "every week", "every 2 weeks", "every month", "every 3 months".
export function periodLabel(unit: "week" | "month", count: number): string {
  return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`;
}
