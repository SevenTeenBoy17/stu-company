import { PlatformLayout } from "@/components/platform/platform-layout";
import { AccessGate } from "@/components/shared/access-gate";
import { StudentMarketBoard } from "@/components/student/student-market-board";
import { getPeerHeatForStudent, getSimulationStateForUser } from "@/lib/db/repo";
import { getMarketBoardPayload } from "@/lib/market-data";
import { getCurrentUser } from "@/lib/session-user";
import { buildStudentWatchlistPayload } from "@/lib/student-watchlist";

// UI-DEBT: Market board layout was refactored, but component-level hardcoded class cleanup is not complete; see docs/ui-spec/audit-2026-05-25.md.
export default async function StudentMarketPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "student") {
    return (
      <div className="page-shell py-10">
        <AccessGate
          title="市场信息页需要学生账号登录"
          description="请先从试玩入口使用学生样例账号登录，或使用学生邀请码注册后进入。登录后这里会展示 AI / 科技观察池、教学综合评分、趋势速写与行业热度分布。"
        />
      </div>
    );
  }

  const initialPayload = await getMarketBoardPayload("MU");
  const [state, initialPeerHeatPayload] = await Promise.all([
    getSimulationStateForUser(user.id),
    getPeerHeatForStudent(user.id),
  ]);
  const initialWatchlistPayload = buildStudentWatchlistPayload(state.run, initialPayload);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="先看市场主线，再看结构和节奏。市场信息页只做观察与理解，不直接做下单入口。"
    >
      <StudentMarketBoard
        initialPayload={initialPayload}
        initialWatchlistPayload={initialWatchlistPayload}
        initialPeerHeatPayload={initialPeerHeatPayload}
      />
    </PlatformLayout>
  );
}
