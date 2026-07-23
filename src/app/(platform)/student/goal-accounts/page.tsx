import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentGoalAccountsDashboard } from "@/components/student/student-goal-accounts-dashboard";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildGoalAccountsPayload } from "@/lib/goal-accounts";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "目标账户 - Brown Zone",
  description: "把电脑、研学、备用金和创业启动金拆成可执行的生活理财目标。",
};

export default async function StudentGoalAccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/demo?auth=login&reason=login_required&next=${encodeURIComponent("/student/goal-accounts")}`);
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);
  const payload = buildGoalAccountsPayload(state.run);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：目标储蓄、生活现金流、投资试错与 AI 导师复盘。"
    >
      <StudentGoalAccountsDashboard initialPayload={payload} />
    </PlatformLayout>
  );
}
