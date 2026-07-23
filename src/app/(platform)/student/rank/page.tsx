import { PlatformLayout } from "@/components/platform/platform-layout";
import { AccessGate } from "@/components/shared/access-gate";
import { RankDashboard } from "@/components/student/rank/rank-dashboard";
import { getCurrentUser } from "@/lib/session-user";

export default async function StudentRankPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "student") {
    return (
      <div className="page-shell py-10">
        <AccessGate
          title="学习进度榜需要学生账号登录"
          description="请先用学生样例账号登录，或使用学生邀请码注册后进入。登录后这里会展示你的学习点、复盘节奏与校内 / 同城 / 全国学习区间。"
        />
      </div>
    );
  }

  return (
    <PlatformLayout
      role="student"
      heading="学习进度榜"
      summary="记录决策质量，不代表真实投资能力。"
    >
      <RankDashboard />
    </PlatformLayout>
  );
}
