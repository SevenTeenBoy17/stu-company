import { describe, expect, it } from "vitest";

import { formatMotionNumber, premiumMotion } from "./motion-system";

describe("formatMotionNumber", () => {
  it("formats currency-like animated values with the requested prefix", () => {
    expect(formatMotionNumber(125748, "currency", "¥")).toBe("¥125,748");
  });

  it("formats percent values with suffix-safe percent signs", () => {
    expect(formatMotionNumber(12.34, "percent")).toBe("12.3%");
  });

  it("keeps plain integer values compact for dashboard counters", () => {
    expect(formatMotionNumber(53, "integer")).toBe("53");
  });
});

describe("premiumMotion selector contract", () => {
  it("includes scroll storytelling and data visualization hooks", () => {
    expect(premiumMotion.selector.scene).toBe("[data-motion-scene]");
    expect(premiumMotion.selector.sceneItem).toBe("[data-motion-scene-item]");
    expect(premiumMotion.selector.parallax).toBe("[data-motion-parallax]");
    expect(premiumMotion.selector.viz).toBe("[data-motion-viz]");
    expect(premiumMotion.selector.vizPath).toBe("[data-motion-viz-path]");
  });

  it("locks the v2 primitives (split / magnetic / story) selector strings", () => {
    // 审查 #12：这些字符串是 provider 与 DOM data-* 的唯一契约，
    // 改名/笔误只会安静地匹配到 0 个目标，必须由契约测试锁死。
    expect(premiumMotion.selector.split).toBe("[data-motion-split]");
    expect(premiumMotion.selector.magnetic).toBe("[data-motion-magnetic]");
    expect(premiumMotion.selector.story).toBe("[data-motion-story]");
    expect(premiumMotion.selector.storyStep).toBe("[data-motion-story-step]");
  });
});
