import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentQuestDashboard } from "@/components/student/student-quest-dashboard";
import { getLearningProgress, getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildStudentQuestPayload } from "@/lib/quests";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "任务中心 - Brown Zone",
  description: "把真实沙盘行为转化为任务、成就和收益日历，帮助学生在玩中学会多元理财习惯。",
};

export default async function StudentQuestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const [state, learning] = await Promise.all([
    getSimulationStateForUser(user.id),
    getLearningProgress(user.id),
  ]);
  const payload = buildStudentQuestPayload(state.run, learning);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentQuestDashboard payload={payload} />
    </PlatformLayout>
  );
}
