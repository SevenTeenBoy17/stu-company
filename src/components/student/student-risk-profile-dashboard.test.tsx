import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { buildRiskProfilePayload } from "@/lib/risk-profile";
import { createInitialRun } from "@/lib/simulation";

import { StudentRiskProfileDashboard } from "./student-risk-profile-dashboard";

function makePayload() {
  const run = createInitialRun("test-student-1", "test-classroom-1");
  return buildRiskProfilePayload(run);
}

/** The counter span renders `{completed}/{total} 已选择` split across text nodes.
 * This helper grabs the span by searching for the 已选择 suffix and returns its
 * full textContent so we can assert the composite value. */
function getCounterText(): string {
  const span = screen.getByText((content, element) => {
    if (!element) return false;
    // Match the span whose full text includes "已选择"
    return element.tagName === "SPAN" && (element.textContent ?? "").includes("已选择");
  });
  return span.textContent?.replace(/\s+/g, "") ?? "";
}

describe("StudentRiskProfileDashboard — new student (no persisted answers)", () => {
  it("selection counter advances from 0/6 to 1/6 when the first option is clicked", () => {
    const payload = makePayload();
    render(
      <StudentRiskProfileDashboard
        initialPayload={payload}
        initialAnswersPersisted={false}
      />,
    );

    // Before any click, the counter must show 0/6
    expect(getCounterText()).toBe("0/6已选择");

    // Find all option buttons in the first scenario card and click the first one
    const optionButtons = screen.getAllByRole("button", { name: /.+/ });
    // Filter to the scenario option buttons (not the submit button)
    const scenarioButtons = optionButtons.filter(
      (btn) => !btn.textContent?.includes("生成我的投资人格"),
    );
    expect(scenarioButtons.length).toBeGreaterThan(0);

    fireEvent.click(scenarioButtons[0]);

    // After clicking, the counter must advance to 1/6
    expect(getCounterText()).toBe("1/6已选择");
  });
});
