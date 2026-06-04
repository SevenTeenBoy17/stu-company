import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { rlsClaimsForUser, withUserRls } from "@/lib/db/rls-context";
import { getLeaderboardBoard } from "@/lib/leaderboard/service";
import type { RankScope } from "@/lib/leaderboard/ranking";
import type { RankPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

const SCOPES: RankScope[] = ["school", "city", "province", "nation"];
const PERIODS: RankPeriod[] = ["weekly", "monthly", "season"];

function coerceScope(value: string | null): RankScope {
  return SCOPES.includes(value as RankScope) ? (value as RankScope) : "school";
}
function coercePeriod(value: string | null): RankPeriod {
  return PERIODS.includes(value as RankPeriod) ? (value as RankPeriod) : "weekly";
}

/** A ranked board for scope x period, with the viewer's own rank attached. */
export async function GET(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  const sp = new URL(request.url).searchParams;
  const scope = coerceScope(sp.get("scope"));
  const period = coercePeriod(sp.get("period"));
  const page = Math.max(1, Number(sp.get("page")) || 1);
  // Client may request a page size; clamp to a sane range (default 50).
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 50));

  const board = await withUserRls(rlsClaimsForUser(auth.user), () =>
    getLeaderboardBoard(auth.user.id, scope, period, { page, pageSize }),
  );
  if (!board) {
    // No rank profile yet — the UI should route to onboarding.
    return NextResponse.json({ board: null, needsOnboarding: true });
  }
  return NextResponse.json({ board, viewerId: auth.user.id });
}
