import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { Disclosure } from "./disclosure";

/**
 * 审查 #10：jsdom 不做真实布局，对任意值类（grid-rows-[0fr] + invisible 的
 * Tailwind 类名）toBeVisible 恒真——收起态断言过不出「面板被藏起」的失败信号。
 * 改为断言组件的有效可见性信号本身：收起态外层含 grid-rows-[0fr] 且内层含
 * invisible；展开态外层含 grid-rows-[1fr] 且内层不含 invisible。
 * 真实浏览器里的可见性由 tests/e2e/ui-v2-smoke.spec.ts 兜底验证。
 */
function panelParts(panelId: string) {
  const panel = document.getElementById(panelId);
  expect(panel).not.toBeNull();
  const inner = panel!.firstElementChild as HTMLElement | null;
  expect(inner).not.toBeNull();
  return { panel: panel!, inner: inner! };
}

function expectCollapsed(panelId: string) {
  const { panel, inner } = panelParts(panelId);
  expect(panel.className).toContain("grid-rows-[0fr]");
  expect(panel.className).not.toContain("grid-rows-[1fr]");
  expect(inner.className).toContain("invisible");
}

function expectExpanded(panelId: string) {
  const { panel, inner } = panelParts(panelId);
  expect(panel.className).toContain("grid-rows-[1fr]");
  expect(panel.className).not.toContain("grid-rows-[0fr]");
  expect(inner.className).not.toContain("invisible");
}

describe("Disclosure (v2 信息收敛)", () => {
  it("starts collapsed, expands on click, and wires aria-expanded/controls", async () => {
    const user = userEvent.setup();
    render(<Disclosure summary="查看完整点评">这里是折叠的长解说内容。</Disclosure>);

    const trigger = screen.getByRole("button", { name: "查看完整点评" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const panelId = trigger.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expectCollapsed(panelId!);

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("这里是折叠的长解说内容。")).toBeInTheDocument();
    expectExpanded(panelId!);

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expectCollapsed(panelId!);
  });

  it("respects defaultOpen", () => {
    render(
      <Disclosure summary="默认展开" defaultOpen>
        直接可见。
      </Disclosure>,
    );
    const trigger = screen.getByRole("button", { name: "默认展开" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("直接可见。")).toBeInTheDocument();
    expectExpanded(trigger.getAttribute("aria-controls")!);
  });

  it("has no axe violations (open state)", async () => {
    const { container } = render(
      <Disclosure summary="无障碍检查" defaultOpen>
        内容
      </Disclosure>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
