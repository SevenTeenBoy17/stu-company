import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentLifeCashflowDashboard } from "@/components/student/student-life-cashflow-dashboard";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildLifeCashflowPayload } from "@/lib/life-cashflow";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "生活现金流 - Brown Zone",
  description: "把预算、应急金、保险和突发事件放进一张可交互的生活账本中练习。",
};

export default async function StudentLifePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);
  const payload = buildLifeCashflowPayload(state.run);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentLifeCashflowDashboard initialPayload={payload} />
    </PlatformLayout>
  );
}

