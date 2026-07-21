import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentAutoInvestDashboard } from "@/components/student/student-auto-invest-dashboard";
import { buildAutoInvestPayload } from "@/lib/auto-invest";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "定投机器人 - Brown Zone",
  description: "用自动定投训练平均成本法、现金安全垫和长期纪律。",
};

export default async function StudentAutoInvestPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/demo?auth=login&reason=login_required&next=${encodeURIComponent("/student/auto-invest")}`);
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);
  const payload = buildAutoInvestPayload(state.run);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentAutoInvestDashboard initialPayload={payload} />
    </PlatformLayout>
  );
}
