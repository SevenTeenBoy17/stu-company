import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getSeasonLeaderboard } from "@/lib/db/repo";
import { currentSeasonKey } from "@/lib/season";

export const dynamic = "force-dynamic";

/** P2: global weekly season leaderboard (everyone this week shares one market). */
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const leaderboard = await getSeasonLeaderboard();
  return NextResponse.json({
    seasonKey: currentSeasonKey(),
    leaderboard: leaderboard.slice(0, 20),
    viewerId: auth.user.id,
  });
}
