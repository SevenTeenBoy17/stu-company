import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildRiskProfilePayload } from "@/lib/risk-profile";
import { createInitialRun } from "@/lib/simulation";

import { StudentRiskProfileDashboard } from "./student-risk-profile-dashboard";

function makePayload() {
  const run = createInitialRun("test-student-1", "test-classroom-1");
  return buildRiskProfilePayload(run);
}

describe("StudentRiskProfileDashboard — new student (no persisted answers)", () => {
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
});
