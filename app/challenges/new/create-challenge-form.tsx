"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { Spinner } from "@/app/spinner";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/app/ui-classes";
import { createChallengeAction, type CreateChallengeState } from "./actions";
import { ParticipantPicker, type Participant } from "./participant-picker";

// Mirrors NAME_MAX / DESCRIPTION_MAX / PERIOD_COUNT_MAX in lib/challenges.ts
// (server-only).
const NAME_MAX = 100;
const DESCRIPTION_MAX = 2000;
const PERIOD_COUNT_MAX = 12;

type Kind = "fixed" | "periodic";
type PeriodUnit = "week" | "month";

const KIND_OPTIONS: { value: Kind; label: string; hint: string }[] = [
  { value: "fixed", label: "Fixed end", hint: "Most points at the end wins" },
  { value: "periodic", label: "Recurring", hint: "Points reset every period" },
];

// Today's date (YYYY-MM-DD) and the IANA time zone in the browser; undefined
// during SSR, where the viewer's time zone isn't known.
const noopSubscribe = () => () => {};
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// The date and time inputs are read as the creator's local time and sent as
// one UTC instant, so the server never has to guess a time zone.
function toIsoInstant(date: string, time: string): string {
  if (!date || !time) return "";
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function CreateChallengeForm() {
  const [state, formAction, pending] = useActionState<CreateChallengeState, FormData>(
    createChallengeAction,
    { status: "idle" },
  );
  // Controlled fields, so values survive a failed submission (React resets
  // uncontrolled fields after a form action).
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Kind>("fixed");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("23:59");
  const [periodCount, setPeriodCount] = useState("1");
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>("week");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const today = useSyncExternalStore(noopSubscribe, localToday, () => undefined);
  const timeZone = useSyncExternalStore(noopSubscribe, localTimeZone, () => undefined);
  const plural = periodCount.trim() !== "1";

  const errors = state.errors ?? {};

  return (
    <form action={formAction} noValidate className="flex w-full max-w-lg flex-col gap-5 text-left">
      <div className="flex flex-col gap-1">
        <Link
          href="/"
          className="-ml-2 inline-flex min-h-11 w-fit items-center rounded-lg px-2 text-base font-medium text-primary cursor-pointer transition hover:scale-98"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">New challenge</h1>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          name="name"
          type="text"
          required
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
          className={inputClass}
        />
        <FieldError message={errors.name} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Description <span className="font-normal text-foreground/60">(optional)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={!!errors.description}
          className={`${inputClass} py-2`}
        />
        <FieldError message={errors.description} />
      </label>

      {/* Toggle buttons + a hidden input rather than radios: React resets the
          form after an action, which unchecks radios in the DOM without
          touching state, while hidden inputs keep their value. */}
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Type</legend>
        <div className="grid grid-cols-2 gap-3">
          {KIND_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={kind === o.value}
              onClick={() => setKind(o.value)}
              className="flex min-h-11 min-w-0 cursor-pointer flex-col justify-center gap-0.5 rounded-lg border border-foreground/20 bg-surface px-3 py-2 text-left transition hover:scale-98 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/40"
            >
              <span className="text-base font-semibold">{o.label}</span>
              <span className="text-sm text-foreground/70">{o.hint}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
        <FieldError message={errors.kind} />
      </fieldset>

      {kind === "fixed" ? (
        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Ends</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm text-foreground/70">Date</span>
              <input
                type="date"
                required
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!errors.endsAt}
                className={inputClass}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm text-foreground/70">Time</span>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-invalid={!!errors.endsAt}
                className={inputClass}
              />
            </label>
          </div>
          <input type="hidden" name="endsAt" value={toIsoInstant(date, time)} />
          <FieldError message={errors.endsAt} />
        </fieldset>
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Resets every</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm text-foreground/70">Number</span>
              <input
                name="periodCount"
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={PERIOD_COUNT_MAX}
                step={1}
                value={periodCount}
                onChange={(e) => setPeriodCount(e.target.value)}
                aria-invalid={!!errors.period}
                className={inputClass}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm text-foreground/70">Unit</span>
              <select
                name="periodUnit"
                value={periodUnit}
                onChange={(e) => setPeriodUnit(e.target.value as PeriodUnit)}
                aria-invalid={!!errors.period}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="week">{plural ? "weeks" : "week"}</option>
                <option value="month">{plural ? "months" : "month"}</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="timeZone" value={timeZone ?? ""} />
          <p className="text-sm text-foreground/70">
            {periodUnit === "week"
              ? "Periods start on a Monday at 00:00"
              : "Periods start on the 1st of the month at 00:00"}
            {timeZone ? ` (${timeZone})` : ""}. The current period has already started, so the
            first one is shorter.
          </p>
          <FieldError message={errors.period} />
        </fieldset>
      )}

      <ParticipantPicker selected={participants} onChange={setParticipants} error={errors.participants} />

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/" className={`${secondaryButtonClass} w-full sm:w-auto`}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full sm:w-auto`}>
          {pending && <Spinner className="size-5" />}
          {pending ? "Creating…" : "Create challenge"}
        </button>
      </div>

      <p role="status" aria-live="polite" className="min-h-6 text-base font-medium text-error">
        {state.status === "error" && "Something went wrong. Try again."}
        {state.status === "invalid" && "Fix the highlighted fields and try again."}
      </p>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-sm font-medium text-error">{message}</span>;
}
