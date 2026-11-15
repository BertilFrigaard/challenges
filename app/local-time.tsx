"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// Shows an instant in the viewer's own time zone. The server doesn't know that
// zone, so it renders a neutral placeholder and the browser fills it in.
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => formatter.format(new Date(iso)),
    () => null,
  );
  return (
    <time dateTime={iso} className={text ? undefined : "invisible"}>
      {text ?? "—"}
    </time>
  );
}
