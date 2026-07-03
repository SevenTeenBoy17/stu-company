import { redirect } from "next/navigation";

import { GuestUpgradeCheckout } from "@/components/billing/guest-upgrade-checkout";
import { PlatformLayout } from "@/components/platform/platform-layout";
import { SubscriptionBanner } from "@/components/shared/subscription-banner";
import { StudentOnboardingGate } from "@/components/student/student-onboarding-gate";
import { StudentSandbox } from "@/components/student/student-sandbox";
import { resolveSubscriptionState } from "@/lib/billing/subscription";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { getCurrentUser } from "@/lib/session-user";

export default async function StudentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const initialState = await getSimulationStateForUser(user.id);
  // 水合确定性：服务端一次性产生渲染时刻，供客户端首帧派生 payload 复用（rank2 根治）。
  const renderedAt = new Date().toISOString();
  const needsOnboarding = !user.onboardingCompleted;
  const isSharedGuest = user.id === "guest-student" || user.email.toLowerCase() === "guest@brownzone.ai";
  const subState = resolveSubscriptionState(
    user.subscriptionTier,
    user.trialExpiresAt,
    user.subscriptionExpiresAt,
  );

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <SubscriptionBanner state={subState} role={user.role} />
      {isSharedGuest ? <GuestUpgradeCheckout /> : null}
      <StudentOnboardingGate
        userName={user.name}
        needsOnboarding={needsOnboarding}
        showUpgradeShortcut={isSharedGuest}
      >
        <StudentSandbox initialState={initialState} renderedAt={renderedAt} />
      </StudentOnboardingGate>
    </PlatformLayout>
  );
}
