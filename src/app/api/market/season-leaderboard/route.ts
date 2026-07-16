import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getSeasonLeaderboard } from "@/lib/db/repo";
import { currentSeasonKey } from "@/lib/season";
import type { PublicSeasonLeaderboardEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 本周赛季榜（按 viewer 班级作用域）。itest7 P1：绝不向客户端透传每位玩家的内部
 * userId/classroomId（会被拿去关联 别名↔身份、枚举其他未成年人）——服务端算好 isViewer 后剥离。
 */
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const viewerId = auth.user.id;
  const leaderboard = await getSeasonLeaderboard(auth.user.classroomId ?? "");
  const publicLeaderboard: PublicSeasonLeaderboardEntry[] = leaderboard
    .slice(0, 20)
    .map((entry) => ({
      rank: entry.rank,
      name: entry.name,
      netWorth: entry.netWorth,
      disciplineScore: entry.disciplineScore,
      isViewer: entry.userId === viewerId,
    }));

  return NextResponse.json({
    seasonKey: currentSeasonKey(),
    leaderboard: publicLeaderboard,
  });
}
