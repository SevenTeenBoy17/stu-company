import { PlatformLayout } from "@/components/platform/platform-layout";
import { AccessGate } from "@/components/shared/access-gate";
import { StudentMarketBoard } from "@/components/student/student-market-board";
import { getMarketBoardPayload } from "@/lib/market-data";
import { getCurrentUser } from "@/lib/session-user";

export default async function StudentMarketPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "student") {
    return (
      <div className="page-shell py-10">
        <AccessGate
          title="市场信息页需要学生账户登录"
          description="请先从试玩入口使用学生样例账户登录，或使用学生邀请码注册后进入。登录后这里会展示 AI / 科技观察池、教学综合评分、趋势速写与行业热度分布。"
        />
      </div>
    );
  }

  const initialPayload = await getMarketBoardPayload("MU");

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="在这里先看市场主线，再看结构和节奏。市场信息页只做观察与理解，不直接做下单入口。"
    >
      <StudentMarketBoard initialPayload={initialPayload} />
    </PlatformLayout>
  );
}
