import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentCreditLabDashboard } from "@/components/student/student-credit-lab-dashboard";
import { buildCreditLabPayload } from "@/lib/credit-lab";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "信用实验室 - Brown Zone",
  description: "把分期、借款、提前还款和利息成本放进同一张沙盘中练习。",
};

export default async function StudentCreditPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/demo?auth=login&reason=login_required&next=${encodeURIComponent("/student/credit")}`);
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);
  const payload = buildCreditLabPayload(state.run);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、信用、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentCreditLabDashboard initialPayload={payload} />
    </PlatformLayout>
  );
}
