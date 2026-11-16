"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Spinner } from "@/app/spinner";
import { dangerButtonClass, primaryButtonClass } from "@/app/ui-classes";
import { deleteChallengeAction } from "./actions";

// How long the delete button stays locked after the dialog opens, so a
// challenge is never deleted by a reflexive tap.
const LOCK_SECONDS = 10;

export function DeleteChallenge({
  challengeId,
  challengeName,
  unitPlural,
}: {
  challengeId: string;
  challengeName: string;
  unitPlural: string;
}) {
  // A new session per open remounts the dialog, so the countdown restarts.
  const [session, setSession] = useState<number | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setSession((s) => (s ?? 0) + 1)}
        className={`${dangerButtonClass} w-full sm:w-fit`}
      >
        Delete challenge
      </button>
      {session !== null && (
        <DeleteDialog
          key={session}
          challengeId={challengeId}
          challengeName={challengeName}
          unitPlural={unitPlural}
          onClosed={() => setSession(null)}
        />
      )}
    </>
  );
}

function DeleteDialog({
  challengeId,
  challengeName,
  unitPlural,
  onClosed,
}: {
  challengeId: string;
  challengeName: string;
  unitPlural: string;
  onClosed: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(LOCK_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = secondsLeft > 0;

  useEffect(() => {
    dialogRef.current?.showModal();
    keepRef.current?.focus();
  }, []);

  // Counts against a deadline rather than decrementing per tick, so a
  // throttled background tab can't make the lock last longer or shorter.
  useEffect(() => {
    const deadline = Date.now() + LOCK_SECONDS * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const confirmDelete = () => {
    setError(null);
    startTransition(async () => {
      // Redirects home on success; only returns on failure.
      const result = await deleteChallengeAction(challengeId);
      setError(result.message);
    });
  };

  return (
    // Escape and close() both fire "close"; the parent then unmounts this.
    // A click whose target is the dialog itself landed on the backdrop.
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onClose={onClosed}
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) e.currentTarget.close();
      }}
      className="mx-0 mt-auto mb-0 max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] w-full max-w-none overflow-y-auto rounded-t-2xl bg-background p-0 text-foreground backdrop:bg-black/50 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-2xl"
    >
      <div className="flex flex-col gap-4 px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-left sm:p-6">
        <h2 id="delete-title" className="text-xl font-semibold break-words">
          Delete “{challengeName}”?
        </h2>
        <div id="delete-description" className="flex flex-col gap-3 text-base text-foreground/85">
          <p>
            This permanently removes the challenge and every participant&apos;s {unitPlural}. It can&apos;t be
            undone.
          </p>
          <p className="rounded-lg bg-surface px-3 py-2">
            To prevent accidents, the delete button unlocks after {LOCK_SECONDS} seconds.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <button
            ref={keepRef}
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
            className={`${primaryButtonClass} w-full sm:w-auto`}
          >
            No, keep it
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={locked || pending}
            className={`${dangerButtonClass} w-full sm:w-auto`}
          >
            {pending && <Spinner className="size-5" />}
            {pending
              ? "Deleting…"
              : locked
                ? `Yes, delete (${secondsLeft}s)`
                : "Yes, delete this challenge"}
          </button>
        </div>

        {/* Announced once when the lock lifts, not on every tick. */}
        <p role="status" aria-live="polite" className="sr-only">
          {locked ? "" : "The delete button is now available."}
        </p>
        {error && (
          <p role="alert" className="text-base font-medium text-error">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
