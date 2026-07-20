import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { TabbedPanel } from "./tabbed-panel";

const TABS = [
  { id: "a", label: "概览", content: <p>概览内容</p> },
  { id: "b", label: "详情", content: <p>详情内容</p> },
  { id: "c", label: "复盘", content: <p>复盘内容</p> },
];

describe("TabbedPanel (v2 信息收敛)", () => {
  it("renders WAI-ARIA tabs with exactly one selected + roving tabIndex", () => {
    render(<TabbedPanel tabs={TABS} ariaLabel="示例分页" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("概览内容");
  });

  it("moves selection with arrow keys and wraps at the ends", async () => {
    const user = userEvent.setup();
    render(<TabbedPanel tabs={TABS} ariaLabel="示例分页" />);
    const [first] = screen.getAllByRole("tab");
    first.focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "详情" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("详情内容");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    // a ← b, then wrap to the last tab.
    expect(screen.getByRole("tab", { name: "复盘" })).toHaveAttribute("aria-selected", "true");
  });

  it("has no axe violations", async () => {
    const { container } = render(<TabbedPanel tabs={TABS} ariaLabel="示例分页" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
