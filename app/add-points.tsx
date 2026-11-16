"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { Spinner } from "@/app/spinner";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/app/ui-classes";
import { addPointsAction, type AddPointsState } from "./points-actions";

// Mirrors POINTS_MAX in lib/challenges.ts (server-only).
const POINTS_MAX = 1_000_000;
const NOTICE_MS = 4000;

type ChallengeOption = { id: string; name: string };

const OpenContext = createContext<((challengeId: string) => void) | null>(null);

// Owns the single add-points dialog for the home screen. `challenges` are the
// ones points can be added to, in dropdown order.
export function AddPointsProvider({
  challenges,
  children,
}: {
  challenges: ChallengeOption[];
  children: React.ReactNode;
}) {
  // A new session per open remounts the dialog, so its fields start fresh.
  const [open, setOpen] = useState<{ challengeId: string; session: number } | null>(null);
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const openFor = (challengeId: string) =>
    setOpen((prev) => ({ challengeId, session: (prev?.session ?? 0) + 1 }));

  return (
    <OpenContext value={openFor}>
      {children}
      {open && (
        <AddPointsDialog
          key={open.session}
          challenges={challenges}
          initialChallengeId={open.challengeId}
          onClosed={() => setOpen(null)}
          onAdded={(challengeId, amount) => {
            const name = challenges.find((c) => c.id === challengeId)?.name ?? "the challenge";
            const points = amount === 1 ? "1 point" : `${amount.toLocaleString()} points`;
            setNotice({ text: `Added ${points} to ${name}.`, id: Date.now() });
          }}
        />
      )}
      {/* Always rendered, so screen readers pick up the message when it appears. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex justify-center"
      >
        {notice && (
          <p
            key={notice.id}
            className="max-w-md rounded-lg bg-primary px-4 py-3 text-base font-medium break-words text-background shadow-lg"
          >
            {notice.text}
          </p>
        )}
      </div>
    </OpenContext>
  );
}

// `icon` is the compact + for cards; `labeled` is a full "Add points" button.
export function AddPointsButton({
  challengeId,
  challengeName,
  variant = "icon",
}: {
  challengeId: string;
  challengeName: string;
  variant?: "icon" | "labeled";
}) {
  const open = use(OpenContext);
  if (!open) throw new Error("AddPointsButton must be inside AddPointsProvider");
  const plus = (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={() => open(challengeId)}
        className={`${primaryButtonClass} w-full sm:w-fit`}
      >
        {plus}
        Add points
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => open(challengeId)}
      aria-label={`Add points to ${challengeName}`}
      title="Add points"
      className="relative z-10 -mt-1 -mr-1 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary text-background transition hover:scale-98 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {plus}
    </button>
  );
}

function AddPointsDialog({
  challenges,
  initialChallengeId,
  onClosed,
  onAdded,
}: {
  challenges: ChallengeOption[];
  initialChallengeId: string;
  onClosed: () => void;
  onAdded: (challengeId: string, amount: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [challengeId, setChallengeId] = useState(initialChallengeId);

  const [state, formAction, pending] = useActionState<AddPointsState, FormData>(
    async (prev, formData) => {
      const next = await addPointsAction(prev, formData);
      if (next.status === "success" && next.added) {
        onAdded(next.added.challengeId, next.added.amount);
        dialogRef.current?.close();
      }
      return next;
    },
    { status: "idle" },
  );
  const errors = state.errors ?? {};

  useEffect(() => {
    dialogRef.current?.showModal();
    amountRef.current?.focus();
  }, []);

  return (
    // Escape and close() both fire "close"; the provider then unmounts this.
    // A click whose target is the dialog itself landed on the backdrop.
    <dialog
      ref={dialogRef}
      aria-labelledby="add-points-title"
      onClose={onClosed}
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) e.currentTarget.close();
      }}
      className="mx-0 mt-auto mb-0 max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] w-full max-w-none overflow-y-auto rounded-t-2xl bg-background p-0 text-foreground backdrop:bg-black/50 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-2xl"
    >
      {/* Submitted by hand rather than via `action`: React resets a form after
          an action, which snaps the <select> back to its first option even
          though it's controlled. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          startTransition(() => formAction(formData));
        }}
        noValidate
        className="flex flex-col gap-5 px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-left sm:p-6"
      >
        <h2 id="add-points-title" className="text-xl font-semibold">
          Add points
        </h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Amount</span>
          <input
            ref={amountRef}
            name="amount"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            required
            maxLength={String(POINTS_MAX).length}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount}
            className={inputClass}
          />
          <FieldError message={errors.amount} />
        </label>

        {challenges.length === 1 ? (
          // Nothing to choose between, e.g. on a challenge's own page.
          <div className="flex flex-col gap-1.5">
            <input type="hidden" name="challengeId" value={challenges[0].id} />
            <p className="text-base break-words text-foreground/80">
              To <span className="font-medium text-foreground">{challenges[0].name}</span>
            </p>
            <FieldError message={errors.challengeId} />
          </div>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Challenge</span>
            <select
              name="challengeId"
              value={challengeId}
              onChange={(e) => setChallengeId(e.target.value)}
              aria-invalid={!!errors.challengeId}
              className={`${inputClass} cursor-pointer`}
            >
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.challengeId} />
          </label>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
            className={`${secondaryButtonClass} w-full sm:w-auto`}
          >
            Cancel
          </button>
          <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full sm:w-auto`}>
            {pending && <Spinner className="size-5" />}
            {pending ? "Adding…" : "Add points"}
          </button>
        </div>

        {state.status === "error" && (
          <p role="alert" className="text-base font-medium text-error">
            Something went wrong. Try again.
          </p>
        )}
      </form>
    </dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-sm font-medium text-error">{message}</span>;
}
