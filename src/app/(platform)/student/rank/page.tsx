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
          title="财商战力榜需要学生账号登录"
          description="请先用学生样例账号登录，或使用学生邀请码注册后进入。登录后这里会展示你的财商战力、段位与校 / 市 / 全国排名。"
        />
      </div>
    );
  }

  return (
    <PlatformLayout
      role="student"
      heading="财商战力榜"
      summary="战力 = 风险调整收益 + 纪律 + 回撤控制 + 学习 + 成长。比的是决策质量，不是谁更敢赌。每周一刷新。"
    >
      <RankDashboard />
    </PlatformLayout>
  );
}
