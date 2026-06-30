import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { recomputeAllRankedUsers } from "@/lib/leaderboard/service";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron daily learning progress recompute. Scheduled in vercel.json; Vercel sends
 * `Authorization: Bearer $CRON_SECRET`. Refreshes every onboarded student's
 * weekly/monthly/season power so boards stay current and the season soft-floor
 * reset reaches inactive students at term boundaries.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !env.CRON_SECRET) {
    return apiError("service_unavailable", "Cron 未配置密钥，已拒绝。", 503);
  }
  if (env.CRON_SECRET) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${env.CRON_SECRET}`) {
      return apiError("unauthorized", "无效的 Cron 凭证。", 401);
    }
  }

  const result = await recomputeAllRankedUsers();
  return NextResponse.json(result);
}
