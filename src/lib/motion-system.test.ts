import { readFileSync } from "node:fs";
import { join } from "node:path";

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

describe("data-motion-number 纯文本子节点契约（itest11 P1 静态回归）", () => {
  // count-up 用 textContent 覆写节点：元素子节点会被摘出 DOM，此后 React 只更新
  // 已脱离文档的节点，屏上数字冻结。契约=number 目标只允许纯文本子节点；
  // provider 侧有 childElementCount 守卫，消费侧不得再往 number 节点里嵌组件。
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("provider 保留元素子节点守卫（childElementCount 早退）", () => {
    const provider = read("src/components/shared/premium-motion-provider.tsx");
    expect(provider).toMatch(/childElementCount > 0\) return/);
  });

  it("student-sandbox 的 data-motion-number 节点不再嵌 MoneyText", () => {
    const sandbox = read("src/components/student/student-sandbox.tsx");
    // data-motion-number 开标签到闭合 </p> 之间不允许出现 <MoneyText
    const blocks = sandbox.split("data-motion-number").slice(1);
    for (const block of blocks) {
      const upToClose = block.slice(0, block.indexOf("</p>"));
      expect(upToClose).not.toContain("<MoneyText");
    }
  });
});
