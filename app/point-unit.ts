import type { PointUnit } from "@/lib/challenges";

// The unit's word for an amount: singular for 1 (or -1), plural otherwise.
export function unitWord(n: number, unit: PointUnit): string {
  return Math.abs(n) === 1 ? unit.singular : unit.plural;
}

// "1 minute", "1,234 minutes".
export function formatAmount(n: number, unit: PointUnit): string {
  return `${n.toLocaleString("en-US")} ${unitWord(n, unit)}`;
}

// Units are stored lowercase; headings start with a capital.
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
