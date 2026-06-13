import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentHistoryReviewDashboard } from "@/components/student/student-history-review-dashboard";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildHistoryReviewPayload } from "@/lib/history-review";
import { getCurrentUser } from "@/lib/session-user";

// UI-DEBT: History page still needs a component-token pass plus richer loading/error states; see docs/ui-spec/audit-2026-05-25.md.
export default async function StudentHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const initialState = await getSimulationStateForUser(user.id);
  const initialPayload = buildHistoryReviewPayload(initialState);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="把每一回合的净值、风险、纪律和关键动作放回同一条时间线上，帮助你看清哪些决定真正推动了成长。"
    >
      <StudentHistoryReviewDashboard initialPayload={initialPayload} />
    </PlatformLayout>
  );
}
