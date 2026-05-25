import { PlatformLayout } from "@/components/platform/platform-layout";
import { AccessGate } from "@/components/shared/access-gate";
import { StudentHistoryReviewDashboard } from "@/components/student/student-history-review-dashboard";
import { buildHistoryReviewPayload } from "@/lib/history-review";
import { getCurrentUser } from "@/lib/session-user";
import { getSimulationStateForUser } from "@/lib/store";

export default async function StudentHistoryPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "student") {
    return (
      <div className="page-shell py-10">
        <AccessGate
          title="历史复盘页需要学生账号登录"
          description="请先从试玩入口使用学生样例账号登录，或使用学生邀请码注册后进入。登录后这里会展示回合趋势、历史操作时间线，以及 AI 生成的复盘总结和下一步建议。"
        />
      </div>
    );
  }

  const initialState = getSimulationStateForUser(user.id);
  const initialPayload = buildHistoryReviewPayload(initialState);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="把每一回合的净值、风险、纪律和关键动作放回同一条时间线上，帮助你看清哪些决定真正推动了成长。"
    >
      <StudentHistoryReviewDashboard initialPayload={initialPayload} />
    </PlatformLayout>
  );
}
