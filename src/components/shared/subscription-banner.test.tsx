import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { SubscriptionState } from "@/lib/billing/subscription";

import { SubscriptionBanner } from "./subscription-banner";

// Branch coverage for the conversion/compliance banner. The load-bearing rule:
// a student (minor) is NEVER shown a direct /pricing pay link — only the
// "generate a parent link" CTA + 家长-safe copy (minors-payment compliance, B1).

const FEATURES = {
  maxStudents: 1,
  deepAiReport: false,
  weeklyParentEmail: false,
  seasonReplay: false,
};

function makeState(over: Partial<SubscriptionState>): SubscriptionState {
  return {
    tier: "free",
    status: "trial",
    canOperate: true,
    canViewHistory: true,
    aiTier: "full",
    bannerMessage: null,
    daysRemaining: null,
    trialMode: null,
    trialDaysRemaining: null,
    subscriptionExpiresAt: null,
    canUsePersonalAiAssessment: false,
    features: FEATURES,
    ...over,
  };
}

describe("SubscriptionBanner", () => {
  it("renders nothing when there is no banner message", () => {
    const { container } = render(
      <SubscriptionBanner state={makeState({ bannerMessage: null })} role="student" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the raw message + a /pricing link for non-student roles", () => {
    render(
      <SubscriptionBanner
        state={makeState({ status: "trial_degraded", bannerMessage: "原始横幅文案" })}
        role="teacher"
      />,
    );
    expect(screen.getByText("原始横幅文案")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /了解/ })).toHaveAttribute("href", "/pricing");
  });

  it("rewrites copy for a student and shows the parent-link CTA — never a direct pay link", () => {
    render(
      <SubscriptionBanner
        state={makeState({ status: "expired", bannerMessage: "原始文案" })}
        role="student"
      />,
    );
    // The raw message is replaced by the compliance-safe 'ask a parent' copy.
    expect(screen.queryByText("原始文案")).toBeNull();
    expect(screen.getByText(/微信支付/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /生成家长付款链接/ })).toBeInTheDocument();
    // Compliance: a minor must NOT be shown the direct /pricing pay link.
    expect(screen.queryByRole("link", { name: /了解/ })).toBeNull();
  });

  it("shows the parent-link CTA for a degraded student trial too", () => {
    render(
      <SubscriptionBanner
        state={makeState({ status: "trial_degraded", bannerMessage: "x" })}
        role="student"
      />,
    );
    expect(screen.getByRole("button", { name: /生成家长付款链接/ })).toBeInTheDocument();
  });

  it("uses error styling when expired and warning styling otherwise", () => {
    const { container: expired } = render(
      <SubscriptionBanner state={makeState({ status: "expired", bannerMessage: "x" })} role="teacher" />,
    );
    expect(expired.querySelector("div")?.className).toContain("error");

    const { container: degraded } = render(
      <SubscriptionBanner
        state={makeState({ status: "trial_degraded", bannerMessage: "x" })}
        role="teacher"
      />,
    );
    expect(degraded.querySelector("div")?.className).toContain("warning");
  });
});
