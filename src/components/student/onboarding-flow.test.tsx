import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OnboardingFlow } from "./onboarding-flow";

vi.mock("@gsap/react", () => ({
  useGSAP: (callback: () => void) => callback(),
}));

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    set: vi.fn(),
    fromTo: vi.fn(),
    utils: { toArray: vi.fn(() => []) },
  },
}));

function jsonResponse(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/billing/status")) {
        return jsonResponse({ canUsePersonalAiAssessment: false });
      }
      if (url.includes("/api/auth/onboarding")) {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({});
    }),
  );
}

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderOnboarding() {
  const onComplete = vi.fn();
  render(
    <>
      <div id="guest-upgrade-checkout" />
      <OnboardingFlow userName="小布朗" showUpgradeShortcut onComplete={onComplete} />
    </>,
  );
  return { onComplete };
}

describe("OnboardingFlow upgrade shortcut scrolling", () => {
  const originalMatchMedia = window.matchMedia;
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  it("uses smooth scrolling when opening the upgrade area by default", async () => {
    mockFetch();
    mockReducedMotion(false);
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const user = userEvent.setup();
    const { onComplete } = renderOnboarding();

    await user.click(screen.getByRole("button", { name: "先开通完整 AI" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }),
    );
  });

  it("uses instant scrolling when the learner prefers reduced motion", async () => {
    mockFetch();
    mockReducedMotion(true);
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const user = userEvent.setup();
    const { onComplete } = renderOnboarding();

    await user.click(screen.getByRole("button", { name: "先开通完整 AI" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" }),
    );
  });
});
