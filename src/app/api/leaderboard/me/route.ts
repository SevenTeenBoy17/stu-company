import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getPowerCard, powerFormula } from "@/lib/leaderboard/service";
import type { RankPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERIODS: RankPeriod[] = ["weekly", "monthly", "season"];

function coercePeriod(value: string | null): RankPeriod {
  return PERIODS.includes(value as RankPeriod) ? (value as RankPeriod) : "weekly";
}

/** The caller's 财商战力 card: power, tier, components, and 4-scope ranks. */
export async function GET(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  const period = coercePeriod(new URL(request.url).searchParams.get("period"));
  const card = await getPowerCard(auth.user.id, period);
  return NextResponse.json({ card, formula: powerFormula() });
}
