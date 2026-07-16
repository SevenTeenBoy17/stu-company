import { NextResponse } from "next/server";

import { authorizeCron } from "@/lib/cron-auth";
import { recomputeAllRankedUsers } from "@/lib/leaderboard/service";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron daily learning progress recompute. Scheduled in vercel.json; Vercel sends
 * `Authorization: Bearer $CRON_SECRET`. Refreshes every onboarded student's
 * weekly/monthly/season power so boards stay current and the season soft-floor
 * reset reaches inactive students at term boundaries.
 */
export async function GET(request: Request) {
  const denied = authorizeCron(request); // 生产必配 + 常量时间比较（itest7 P3）
  if (denied) return denied;

  const result = await recomputeAllRankedUsers();
  return NextResponse.json(result);
}
