"use client";

import { useState, type ReactNode } from "react";
import { OnboardingFlow } from "@/components/student/onboarding-flow";

interface Props {
  userName: string;
  needsOnboarding: boolean;
  children: ReactNode;
}

export function StudentOnboardingGate({ userName, needsOnboarding, children }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);

  return (
    <>
      {showOnboarding && (
        <OnboardingFlow
          userName={userName}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
      {children}
    </>
  );
}
