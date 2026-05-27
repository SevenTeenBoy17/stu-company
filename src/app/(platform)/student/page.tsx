import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentSandbox } from "@/components/student/student-sandbox";
import { StudentOnboardingGate } from "@/components/student/student-onboarding-gate";
import { SubscriptionBanner } from "@/components/shared/subscription-banner";
import { getCurrentUser } from "@/lib/session-user";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";

export default async function StudentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const initialState = await getSimulationStateForUser(user.id);
  const needsOnboarding = !user.onboardingCompleted;

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的一整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <SubscriptionBanner tier={user.subscriptionTier} trialExpiresAt={user.trialExpiresAt} role={user.role} />
      <StudentOnboardingGate userName={user.name} needsOnboarding={needsOnboarding}>
        <StudentSandbox initialState={initialState} />
      </StudentOnboardingGate>
    </PlatformLayout>
  );
}
