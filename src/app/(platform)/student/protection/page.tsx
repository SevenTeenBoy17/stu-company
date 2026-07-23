import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentProtectionUmbrellaDashboard } from "@/components/student/student-protection-umbrella-dashboard";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildProtectionUmbrellaPayload } from "@/lib/protection-umbrella";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "风险保护伞 - Brown Zone",
  description: "用应急金、保险、债务压力和分散度理解真实理财中的防守能力。",
};

export default async function StudentProtectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/demo?auth=login&reason=login_required&next=${encodeURIComponent("/student/protection")}`);
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);
  const payload = buildProtectionUmbrellaPayload(state.run);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：应急金、保险、债务、分散投资与 AI 导师复盘。"
    >
      <StudentProtectionUmbrellaDashboard initialPayload={payload} />
    </PlatformLayout>
  );
}
