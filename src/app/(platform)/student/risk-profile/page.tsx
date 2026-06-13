import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentRiskProfileDashboard } from "@/components/student/student-risk-profile-dashboard";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildRiskProfilePayload } from "@/lib/risk-profile";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "风险测评 - Brown Zone",
  description: "通过情境选择生成投资人格、风险画像和下一回合资产配置训练建议。",
};

export default async function StudentRiskProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);
  const payload = buildRiskProfilePayload(state.run);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentRiskProfileDashboard initialPayload={payload} />
    </PlatformLayout>
  );
}

