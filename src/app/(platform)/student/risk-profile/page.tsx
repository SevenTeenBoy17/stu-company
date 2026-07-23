import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentRiskProfileDashboard } from "@/components/student/student-risk-profile-dashboard";
import { getRiskProfile, getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildRiskProfilePayload, riskProfileQuestions, type RiskProfileAnswer } from "@/lib/risk-profile";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "风险测评 - Brown Zone",
  description: "通过情境选择生成投资人格、风险画像和下一回合资产配置训练建议。",
};

function readSavedAnswers(input: Record<string, unknown> | undefined): RiskProfileAnswer[] | undefined {
  const raw = input?.selectedAnswers;
  if (!Array.isArray(raw)) return undefined;

  const answers = raw.flatMap((answer): RiskProfileAnswer[] => {
    if (!answer || typeof answer !== "object") return [];
    const questionId = "questionId" in answer ? answer.questionId : undefined;
    const optionId = "optionId" in answer ? answer.optionId : undefined;
    if (typeof questionId !== "string" || typeof optionId !== "string") return [];

    const question = riskProfileQuestions.find((item) => item.id === questionId);
    const option = question?.options.find((item) => item.id === optionId);
    return question && option ? [{ questionId, optionId }] : [];
  });

  return answers.length > 0 ? answers : undefined;
}

export default async function StudentRiskProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/demo?auth=login&reason=login_required&next=${encodeURIComponent("/student/risk-profile")}`);
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const [state, savedProfile] = await Promise.all([
    getSimulationStateForUser(user.id),
    getRiskProfile(user.id),
  ]);
  const savedAnswers = readSavedAnswers(savedProfile?.answers);
  const savedAt = savedProfile?.updatedAt ? new Date(savedProfile.updatedAt) : undefined;
  const payload = savedAnswers && savedAt
    ? buildRiskProfilePayload(state.run, savedAnswers, savedAt)
    : buildRiskProfilePayload(state.run);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentRiskProfileDashboard initialPayload={payload} initialAnswersPersisted={Boolean(savedAnswers)} />
    </PlatformLayout>
  );
}
