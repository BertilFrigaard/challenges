"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/app/spinner";
import { inputClass } from "@/app/ui-classes";

export type Participant = { id: string; username: string };

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: Participant[] }
  | { status: "error" };

const DEBOUNCE_MS = 250;

// Username search with removable chips. Each chosen user is submitted as a
// hidden `participantIds` input; the creator is added on the server.
export function ParticipantPicker({
  selected,
  onChange,
  error,
}: {
  selected: Participant[];
  onChange: (next: Participant[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`User search failed (${res.status})`);
        setSearch({ status: "done", results: (await res.json()) as Participant[] });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error((err as Error).message);
        setSearch({ status: "error" });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectedIds = new Set(selected.map((p) => p.id));
  const results =
    search.status === "done" ? search.results.filter((r) => !selectedIds.has(r.id)) : [];

  function updateQuery(value: string) {
    setQuery(value);
    setSearch(value.trim() ? { status: "loading" } : { status: "idle" });
  }

  function add(user: Participant) {
    onChange([...selected, user]);
    updateQuery("");
  }

  function remove(id: string) {
    onChange(selected.filter((p) => p.id !== id));
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Participants</legend>
      <p className="text-sm text-foreground/70">You&apos;re included automatically.</p>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2 py-1">
          {selected.map((p) => (
            <li key={p.id} className="max-w-full">
              <input type="hidden" name="participantIds" value={p.id} />
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label={`Remove ${p.username}`}
                className="flex min-h-11 max-w-full items-center gap-2 rounded-full bg-surface pr-3 pl-4 text-base cursor-pointer transition hover:scale-98"
              >
                <span className="truncate">{p.username}</span>
                <span aria-hidden="true" className="text-lg leading-none text-foreground/60">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter picks the first match instead of submitting the form.
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) add(results[0]);
            }
          }}
          placeholder="Search by username"
          aria-label="Search users to add"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!error}
          className={`${inputClass} pr-20 [&::-webkit-search-cancel-button]:appearance-none`}
        />
        {search.status === "loading" && (
          <Spinner className="absolute top-1/2 right-11 size-5 -translate-y-1/2 text-foreground/60" />
        )}
        {query && (
          <button
            type="button"
            onClick={() => {
              updateQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute top-0 right-0 flex size-11 cursor-pointer items-center justify-center text-foreground transition hover:scale-98"
          >
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div aria-live="polite">
        {search.status === "done" && results.length === 0 && (
          <p className="py-2 text-sm text-foreground/70">No matching users.</p>
        )}
        {search.status === "error" && (
          <p className="py-2 text-sm font-medium text-error">Couldn&apos;t search users. Try again.</p>
        )}
        {results.length > 0 && (
          <ul className="flex flex-col overflow-hidden rounded-lg border border-foreground/20">
            {results.map((r) => (
              <li key={r.id} className="border-b border-foreground/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => add(r)}
                  className="group flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-base transition-colors hover:bg-surface"
                >
                  {/* The row background fills edge to edge; only the content scales. */}
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2 transition group-hover:scale-98">
                    <span className="truncate">{r.username}</span>
                    <span className="shrink-0 text-sm font-medium text-primary">Add</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <span className="text-sm font-medium text-error">{error}</span>}
    </fieldset>
  );
}
