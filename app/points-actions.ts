"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { POINTS_MAX, addPointEntry } from "@/lib/challenges";
import { isUuid } from "@/lib/uuid";

export type AddPointsState = {
  status: "idle" | "success" | "invalid" | "error";
  errors?: Partial<Record<"amount" | "challengeId", string>>;
  // On success: what was added where, for the confirmation message.
  added?: { challengeId: string; amount: number };
};

export async function addPointsAction(
  _prev: AddPointsState,
  formData: FormData,
): Promise<AddPointsState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const challengeId = String(formData.get("challengeId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = Number(amountRaw);

  const errors: NonNullable<AddPointsState["errors"]> = {};
  if (!isUuid(challengeId)) errors.challengeId = "Pick a challenge.";
  if (!amountRaw) errors.amount = "Enter an amount.";
  else if (!/^\d+$/.test(amountRaw) || amount < 1) errors.amount = "Enter a whole number of 1 or more.";
  else if (amount > POINTS_MAX) errors.amount = `Keep it at ${POINTS_MAX.toLocaleString("en-US")} or less.`;
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };

  try {
    const added = await addPointEntry({ userId: user.id, challengeId, delta: amount });
    if (!added) {
      return {
        status: "invalid",
        errors: { challengeId: "You can't add points to this challenge." },
      };
    }
  } catch (err) {
    console.error("Adding points failed:", (err as Error).message);
    return { status: "error" };
  }

  refresh();
  return { status: "success", added: { challengeId, amount } };
}
