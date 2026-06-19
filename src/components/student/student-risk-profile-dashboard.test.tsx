import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildRiskProfilePayload } from "@/lib/risk-profile";
import { createInitialRun } from "@/lib/simulation";

import { StudentRiskProfileDashboard } from "./student-risk-profile-dashboard";

function makePayload() {
  const run = createInitialRun("test-student-1", "test-classroom-1");
  return buildRiskProfilePayload(run);
}

describe("StudentRiskProfileDashboard — new student (no persisted answers)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selection counter advances from 0/6 to 1/6 when the first option is clicked", async () => {
    const payload = makePayload();
    render(
      <StudentRiskProfileDashboard
        initialPayload={payload}
        initialAnswersPersisted={false}
      />,
    );

    // Before any click, the counter must show 0/6
    expect(screen.getByTestId("risk-counter").textContent).toBe("0/6 已选择");

    // Find all option buttons in the first scenario card and click the first one
    const optionButtons = screen.getAllByRole("button", { name: /.+/ });
    // Filter to the scenario option buttons (not the submit button)
    const scenarioButtons = optionButtons.filter(
      (btn) => !btn.textContent?.includes("生成我的投资人格"),
    );
    expect(scenarioButtons.length).toBeGreaterThan(0);

    await userEvent.click(scenarioButtons[0]);

    // After clicking, the counter must advance to 1/6
    expect(screen.getByTestId("risk-counter").textContent).toBe("1/6 已选择");
  });

  it("requests a behavior re-evaluation and renders the returned persona", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: {
          band: "balanced",
          label: "证据平衡者",
          archetype: "先看证据，再做配置选择",
          summary: "你已经能观察风险，但需要让仓位纪律更稳定。",
          evidence: ["你在回合中已经开始记录交易理由。"],
          nextSteps: ["下一回合先写观察清单，再调整仓位。"],
          confidence: "medium",
        },
        provider: "remote",
        analyzedAt: "2026-06-18T08:00:00.000Z",
        cached: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StudentRiskProfileDashboard initialPayload={makePayload()} initialAnswersPersisted />);

    await userEvent.click(screen.getByTestId("behavior-persona-submit"));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/student/risk-profile/behavior",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByTestId("behavior-persona-card")).toHaveTextContent("证据平衡者");
    expect(screen.getByText("AI 生成")).toBeInTheDocument();
  });

  it("shows a Chinese retryable error when behavior re-evaluation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "行为复评暂时不可用，请稍后再试。" }),
      }),
    );

    render(<StudentRiskProfileDashboard initialPayload={makePayload()} initialAnswersPersisted />);

    await userEvent.click(screen.getByTestId("behavior-persona-submit"));

    expect(await screen.findByRole("alert")).toHaveTextContent("行为复评暂时不可用，请稍后再试。");
    await waitFor(() => expect(screen.getByTestId("behavior-persona-submit")).not.toBeDisabled());
  });
});

describe("StudentRiskProfileDashboard — behavior re-eval slow-AI hint (REL-01)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does NOT show the slow hint before 8 seconds", async () => {
    // Render with real timers first so GSAP / React scheduler init cleanly
    render(<StudentRiskProfileDashboard initialPayload={makePayload()} initialAnswersPersisted />);

    // fetch never resolves — keeps the component in loading state
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    // Switch to fake timers after render; use fireEvent (synchronous) to avoid
    // userEvent pointer-delay timers interfering with fake timer mode
    vi.useFakeTimers();

    // Click the button to start re-eval
    await act(async () => {
      fireEvent.click(screen.getByTestId("behavior-persona-submit"));
    });

    // Advance to just under 8 seconds — hint must NOT be shown
    await act(async () => {
      vi.advanceTimersByTime(7999);
    });

    expect(screen.queryByTestId("behavior-slow-hint")).toBeNull();

    // Restore before unmount so React scheduler uses real timers during cleanup
    vi.useRealTimers();
  });

  it("shows the slow hint after 8 seconds of loading", async () => {
    // Render with real timers first so GSAP / React scheduler init cleanly
    render(<StudentRiskProfileDashboard initialPayload={makePayload()} initialAnswersPersisted />);

    // fetch never resolves — keeps the component in loading state
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    // Switch to fake timers after render; use fireEvent (synchronous) to avoid
    // userEvent pointer-delay timers interfering with fake timer mode
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByTestId("behavior-persona-submit"));
    });

    // Advance past 8 seconds — hint must appear
    await act(async () => {
      vi.advanceTimersByTime(8001);
    });

    const hint = screen.getByTestId("behavior-slow-hint");
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent("AI 正在分析你的真实操作，稍等几秒…");
    expect(hint).toHaveAttribute("role", "status");
    expect(hint).toHaveAttribute("aria-live", "polite");

    // Restore before unmount so React scheduler uses real timers during cleanup
    vi.useRealTimers();
  });

  it("hint is absent after a successful fetch completes (no fake timers needed)", async () => {
    // This test verifies the conditional: hint renders only when isLoading && behaviorSlow.
    // When loading ends (fetch resolves), isLoading is false so the hint must not be shown
    // regardless of behaviorSlow's value. We use real timers: the fetch resolves before 8s
    // so behaviorSlow never becomes true, confirming the guard is correct.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          persona: {
            band: "balanced",
            label: "证据平衡者",
            archetype: "先看证据，再做配置选择",
            summary: "你已经能观察风险，但需要让仓位纪律更稳定。",
            evidence: ["你在回合中已经开始记录交易理由。"],
            nextSteps: ["下一回合先写观察清单，再调整仓位。"],
            confidence: "medium",
          },
          provider: "remote",
          analyzedAt: "2026-06-18T08:00:00.000Z",
          cached: false,
        }),
      }),
    );

    render(<StudentRiskProfileDashboard initialPayload={makePayload()} initialAnswersPersisted />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("behavior-persona-submit"));
    });

    // Wait for the successful result card to appear (fetch resolved)
    expect(await screen.findByTestId("behavior-persona-card")).toBeInTheDocument();

    // Hint must not be shown when loading has ended
    expect(screen.queryByTestId("behavior-slow-hint")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F3-2 — intent-vs-behavior comparison block (UX-01)
// When behavior band ≠ questionnaire band: "差距" teaching note must render.
// When behavior band === questionnaire band: "一致" line must render instead.
// ---------------------------------------------------------------------------

function makeFetchWithPersona(band: string, label: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      persona: {
        band,
        label,
        archetype: "测试原型",
        summary: "测试总结。",
        evidence: ["测试证据。"],
        nextSteps: ["测试步骤。"],
        confidence: "medium",
      },
      provider: "fallback",
      analyzedAt: "2026-06-18T08:00:00.000Z",
      cached: false,
    }),
  });
}

describe("StudentRiskProfileDashboard — intent-vs-behavior comparison (F3-2)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the 差距 teaching note when behavior band differs from questionnaire band", async () => {
    const payload = makePayload();
    // The default questionnaire payload for a fresh run produces a band; we need
    // the behavior band to differ. Use "growth" (进取挑战者) while questionnaire
    // will likely be "steady" or "defensive" for a fresh/default run.
    vi.stubGlobal("fetch", makeFetchWithPersona("growth", "进取挑战者"));

    render(<StudentRiskProfileDashboard initialPayload={payload} initialAnswersPersisted />);
    await userEvent.click(screen.getByTestId("behavior-persona-submit"));
    await screen.findByTestId("behavior-persona-card");

    // The comparison block must be present
    expect(screen.getByTestId("intent-vs-behavior")).toBeInTheDocument();

    // If the bands differ, the diff note must be shown
    if (payload.band !== "growth") {
      const diffNote = screen.getByTestId("intent-behavior-diff");
      expect(diffNote).toBeInTheDocument();
      // Must mention both labels
      expect(diffNote).toHaveTextContent(payload.label);
      expect(diffNote).toHaveTextContent("进取挑战者");
      expect(diffNote).toHaveTextContent("差距");
      // Same-band note must NOT be shown
      expect(screen.queryByTestId("intent-behavior-same")).toBeNull();
    }
  });

  it("shows the 一致 line when behavior band matches questionnaire band", async () => {
    const payload = makePayload();
    // Mirror the questionnaire band so they match
    const { band, label } = payload;
    vi.stubGlobal("fetch", makeFetchWithPersona(band, label));

    render(<StudentRiskProfileDashboard initialPayload={payload} initialAnswersPersisted />);
    await userEvent.click(screen.getByTestId("behavior-persona-submit"));
    await screen.findByTestId("behavior-persona-card");

    expect(screen.getByTestId("intent-vs-behavior")).toBeInTheDocument();
    expect(screen.getByTestId("intent-behavior-same")).toBeInTheDocument();
    expect(screen.getByTestId("intent-behavior-same")).toHaveTextContent("一致");
    expect(screen.queryByTestId("intent-behavior-diff")).toBeNull();
  });

  it("comparison block shows questionnaire label and behavior label side by side", async () => {
    const payload = makePayload();
    vi.stubGlobal("fetch", makeFetchWithPersona("growth", "进取挑战者"));

    render(<StudentRiskProfileDashboard initialPayload={payload} initialAnswersPersisted />);
    await userEvent.click(screen.getByTestId("behavior-persona-submit"));
    await screen.findByTestId("behavior-persona-card");

    const block = screen.getByTestId("intent-vs-behavior");
    expect(block).toHaveTextContent("问卷倾向");
    expect(block).toHaveTextContent(payload.label);
    expect(block).toHaveTextContent("真实行为");
    expect(block).toHaveTextContent("进取挑战者");
  });
});
