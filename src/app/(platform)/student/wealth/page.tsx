import { redirect } from "next/navigation";

import { ParentBindCard } from "@/components/student/parent-bind-card";
import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentWealthDashboard } from "@/components/student/student-wealth-dashboard";
import { buildWealthSummary } from "@/lib/allocation";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { getCurrentUser } from "@/lib/session-user";
import { buildWealthReviewPayload } from "@/lib/wealth-review";

export const metadata = {
  title: "我的财富 - Brown Zone",
  description: "把现金、储蓄、持仓、房产、创业和负债放在同一张资产配置地图中复盘。",
};

export default async function StudentWealthPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);
  const summary = buildWealthSummary(state.run);
  const review = buildWealthReviewPayload(state.run, summary);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentWealthDashboard summary={summary} review={review} />
      <ParentBindCard />
    </PlatformLayout>
  );
}
