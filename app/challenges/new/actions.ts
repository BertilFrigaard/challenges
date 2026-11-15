"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  PARTICIPANTS_MAX,
  PERIOD_COUNT_MAX,
  PERIOD_UNITS,
  createChallenge,
  existingUserIds,
  type ChallengeSchedule,
  type PeriodUnit,
} from "@/lib/challenges";
import { isUuid } from "@/lib/uuid";

export type CreateChallengeState = {
  status: "idle" | "invalid" | "error";
  errors?: Partial<
    Record<"name" | "description" | "kind" | "endsAt" | "period" | "participants", string>
  >;
};

function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export async function createChallengeAction(
  _prev: CreateChallengeState,
  formData: FormData,
): Promise<CreateChallengeState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const participantIds = [
    ...new Set(formData.getAll("participantIds").map(String).filter((id) => id !== user.id)),
  ];

  const errors: NonNullable<CreateChallengeState["errors"]> = {};
  if (!name) errors.name = "Give the challenge a name.";
  else if (name.length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX} characters.`;
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  }

  let schedule: ChallengeSchedule | undefined;
  if (kind === "fixed") {
    const endsAtRaw = String(formData.get("endsAt") ?? "");
    const endsAt = new Date(endsAtRaw);
    if (!endsAtRaw || Number.isNaN(endsAt.getTime())) errors.endsAt = "Pick an end date and time.";
    else if (endsAt.getTime() <= Date.now()) errors.endsAt = "The end time must be in the future.";
    else schedule = { kind, endsAt };
  } else if (kind === "periodic") {
    const unit = String(formData.get("periodUnit") ?? "");
    const countRaw = String(formData.get("periodCount") ?? "").trim();
    const count = Number(countRaw);
    const timeZone = String(formData.get("timeZone") ?? "");
    if (!(PERIOD_UNITS as readonly string[]).includes(unit)) {
      errors.period = "Pick weeks or months.";
    } else if (!/^\d+$/.test(countRaw) || count < 1 || count > PERIOD_COUNT_MAX) {
      errors.period = `Pick a whole number from 1 to ${PERIOD_COUNT_MAX}.`;
    } else if (!isValidTimeZone(timeZone)) {
      errors.period = "Your time zone could not be detected. Reload the page and try again.";
    } else {
      schedule = { kind, unit: unit as PeriodUnit, count, timeZone };
    }
  } else {
    errors.kind = "Pick a challenge type.";
  }

  if (participantIds.length > PARTICIPANTS_MAX) {
    errors.participants = `A challenge can have at most ${PARTICIPANTS_MAX} other participants.`;
  } else if (!participantIds.every(isUuid)) {
    errors.participants = "Some participants could not be found.";
  }

  try {
    if (!errors.participants) {
      const found = await existingUserIds(participantIds);
      if (found.length !== participantIds.length) {
        errors.participants = "Some participants could not be found.";
      }
    }
    if (Object.keys(errors).length > 0 || !schedule) return { status: "invalid", errors };

    await createChallenge({ creatorId: user.id, name, description, schedule, participantIds });
  } catch (err) {
    console.error("Creating challenge failed:", (err as Error).message);
    return { status: "error" };
  }

  // Outside the try: redirect() works by throwing.
  redirect("/");
}
