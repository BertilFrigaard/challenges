import { getCurrentUser } from "@/lib/auth";
import { searchUsers } from "@/lib/challenges";

// GET /api/users/search?q=<prefix> — used by the participant picker.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q || q.length > 50) return Response.json([]);

  return Response.json(await searchUsers(q, user.id));
}
