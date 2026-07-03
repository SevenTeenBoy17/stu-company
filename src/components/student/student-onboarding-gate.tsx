"use client";

import { useState, type ReactNode } from "react";
import { OnboardingFlow } from "@/components/student/onboarding-flow";

interface Props {
  userName: string;
  needsOnboarding: boolean;
  showUpgradeShortcut?: boolean;
  children: ReactNode;
}

export function StudentOnboardingGate({ userName, needsOnboarding, showUpgradeShortcut = false, children }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);

  return (
    <>
      {showOnboarding && (
        <OnboardingFlow
          userName={userName}
          showUpgradeShortcut={showUpgradeShortcut}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
      {children}
    </>
  );
}
