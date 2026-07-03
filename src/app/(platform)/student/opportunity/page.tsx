import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentOpportunityDashboard } from "@/components/student/student-opportunity-dashboard";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildOpportunityPayload } from "@/lib/opportunity";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "机会训练场 - Brown Zone",
  description: "把市场热点转化为观察单训练，练习证据链、风险意识和下一步验证动作。",
};

export default async function StudentOpportunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="先观察，再行动。机会训练场帮助你把市场热点写成有证据、有风险、有下一步验证的观察单。"
    >
      <StudentOpportunityDashboard initialPayload={buildOpportunityPayload(state.run)} />
    </PlatformLayout>
  );
}
