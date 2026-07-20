import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { Disclosure } from "./disclosure";

describe("Disclosure (v2 信息收敛)", () => {
  it("starts collapsed, expands on click, and wires aria-expanded/controls", async () => {
    const user = userEvent.setup();
    render(<Disclosure summary="查看完整点评">这里是折叠的长解说内容。</Disclosure>);

    const trigger = screen.getByRole("button", { name: "查看完整点评" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const panelId = trigger.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("这里是折叠的长解说内容。")).toBeVisible();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("respects defaultOpen", () => {
    render(
      <Disclosure summary="默认展开" defaultOpen>
        直接可见。
      </Disclosure>,
    );
    expect(screen.getByRole("button", { name: "默认展开" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("直接可见。")).toBeVisible();
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
