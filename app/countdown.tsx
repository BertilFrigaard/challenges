"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const MINUTE = 60_000;
// After reaching zero, how often to refresh again while the server still
// reports the same end (e.g. when this device's clock runs a little ahead).
const RETRY_MS = 10_000;

// Whole minutes left until `to`, rounded up, so it only reads 0 once `to` has passed.
function minutesLeft(to: number): number {
  return Math.max(0, Math.ceil((to - Date.now()) / MINUTE));
}

// "2d 5h", "5h 12m", "45m".
export function formatTimeLeft(minutes: number): string {
  if (minutes <= 0) return "<1m";
  const d = Math.floor(minutes / (24 * 60));
  const h = Math.floor((minutes % (24 * 60)) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Time left until an instant, ticking down each minute. Refreshes the page
// when it runs out, so a period's reset points or an ended challenge show up.
// The server renders a hidden placeholder (it can't know when the page will
// be viewed) and the browser fills it in.
export function Countdown({ to }: { to: string }) {
  const router = useRouter();
  const target = Date.parse(to);

  // Ticks right when the rounded-up minute count changes, i.e. at whole
  // minutes before `to`, re-arming each time so sleep or drift can't skew it.
  const subscribe = useCallback(
    (onTick: () => void) => {
      let timer: ReturnType<typeof setTimeout>;
      const arm = () => {
        const msLeft = target - Date.now();
        if (msLeft <= 0) return;
        timer = setTimeout(() => {
          onTick();
          arm();
        }, (msLeft % MINUTE || MINUTE) + 50);
      };
      arm();
      return () => clearTimeout(timer);
    },
    [target],
  );
  const minutes = useSyncExternalStore(
    subscribe,
    () => minutesLeft(target),
    () => null,
  );

  const done = minutes === 0;
  useEffect(() => {
    if (!done) return;
    router.refresh();
    const retry = setInterval(() => router.refresh(), RETRY_MS);
    return () => clearInterval(retry);
  }, [done, router, to]);

  return (
    <time dateTime={to} className={minutes === null ? "invisible" : "tabular-nums"}>
      {minutes === null ? "—" : formatTimeLeft(minutes)}
    </time>
  );
}
