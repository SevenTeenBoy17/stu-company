import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { rlsClaimsForUser, withUserRls } from "@/lib/db/rls-context";
import { getPowerCard, powerFormula } from "@/lib/leaderboard/service";
import type { RankPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERIODS: RankPeriod[] = ["weekly", "monthly", "season"];

function coercePeriod(value: string | null): RankPeriod {
  return PERIODS.includes(value as RankPeriod) ? (value as RankPeriod) : "weekly";
}

/** The caller's 学习进度 card: learning points, tier, components, and 4-scope bands. */
export async function GET(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  const period = coercePeriod(new URL(request.url).searchParams.get("period"));
  const card = await withUserRls(rlsClaimsForUser(auth.user), () =>
    getPowerCard(auth.user.id, period),
  );
  return NextResponse.json({ card, formula: powerFormula() });
}
