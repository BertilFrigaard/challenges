"use server";

import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { deleteChallenge } from "@/lib/challenges";
import { isUuid } from "@/lib/uuid";

export type DeleteChallengeState = { status: "error"; message: string };

// Deletes the challenge if the current user created it, then goes home. Only
// returns when it didn't work.
export async function deleteChallengeAction(challengeId: string): Promise<DeleteChallengeState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!isUuid(challengeId)) return { status: "error", message: "This challenge doesn't exist." };

  let deleted: boolean;
  try {
    deleted = await deleteChallenge({ challengeId, userId: user.id });
  } catch (err) {
    console.error("Deleting challenge failed:", (err as Error).message);
    return { status: "error", message: "Something went wrong. Try again." };
  }
  if (!deleted) {
    return { status: "error", message: "Only the person who created this challenge can delete it." };
  }
  // Otherwise the browser may show its cached home screen, deleted challenge
  // included. Replace, so Back doesn't return to the deleted challenge.
  revalidatePath("/");
  redirect("/", RedirectType.replace);
}
