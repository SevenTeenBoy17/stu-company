import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentSandbox } from "@/components/student/student-sandbox";
import { getCurrentUser } from "@/lib/session-user";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";

// UI-DEBT: Student dashboard layout was refactored, but component-level hardcoded class cleanup is not complete; see docs/ui-spec/audit-2026-05-25.md.
export default async function StudentPage() {
  // (platform)/layout already redirects anonymous visitors. L3: wrong-role
  // viewers redirect to their own home instead of getting a 200 with an
  // AccessGate card — keeps search engines and CDN caches out of pages that
  // require auth.
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const initialState = await getSimulationStateForUser(user.id);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的一整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentSandbox initialState={initialState} />
    </PlatformLayout>
  );
}
