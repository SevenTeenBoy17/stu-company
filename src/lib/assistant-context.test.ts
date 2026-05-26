import { beforeEach, describe, expect, it } from "vitest";

import { buildAssistantContextBundle } from "@/lib/assistant-context";
import { findUserById, getSimulationStateForUser, resetStoreForTests } from "@/lib/store";

describe("assistant context", () => {
  beforeEach(() => {
    resetStoreForTests();
  });

  it("uses guest mode on public routes", async () => {
    const context = await buildAssistantContextBundle({
      route: "/learn",
      pageContext: {
        route: "/learn",
      },
    });

    expect(context.mode).toBe("guest");
    expect(context.starterPrompts[0]).toContain("Brown Zone");
  });

  it("injects asset and action context on student routes", async () => {
    const user = findUserById("student-1");
    const simulation = getSimulationStateForUser("student-1");
    const asset = simulation.market.assets[0];
    const actionLog = simulation.run.actionLog[0];

    const context = await buildAssistantContextBundle({
      route: "/student",
      user,
      pageContext: {
        route: "/student",
        assetId: asset.id,
        actionLogId: actionLog.id,
      },
    });

    expect(context.mode).toBe("student-context");
    expect(context.contextBlock).toContain(asset.name);
    expect(context.contextBlock).toContain(actionLog.label);
  });
});
