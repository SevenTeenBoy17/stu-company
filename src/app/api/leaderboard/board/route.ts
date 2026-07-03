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
  // itest4 R3 P2：不向客户端透传每位玩家的内部 userId（可被拿去关联 别名↔身份）。
  // 客户端只用它做 React key + 自我高亮；高亮已由服务端 isViewer 承载，key 改用全局唯一
  // 的 rank。其余字段（别名/战力/层级/地区名）是展示数据，可正常下发。
  const sanitizedEntries = board.entries.map((entry) => {
    const { userId: _omitUserId, ...publicEntry } = entry;
    void _omitUserId;
    return publicEntry;
  });
  return NextResponse.json({ board: { ...board, entries: sanitizedEntries } });
}
