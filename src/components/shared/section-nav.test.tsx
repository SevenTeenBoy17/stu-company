import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { SectionNav } from "./section-nav";

const ITEMS = [
  { id: "sec-overview", label: "概览" },
  { id: "sec-detail", label: "教学详情" },
];

function renderWithSections() {
  return render(
    <div>
      <SectionNav items={ITEMS} ariaLabel="页面板块导航" />
      <section id="sec-overview">概览板块</section>
      <section id="sec-detail">详情板块</section>
    </div>,
  );
}

describe("SectionNav (v2 信息收敛)", () => {
  it("renders an aria-labelled nav with one current item", () => {
    renderWithSections();
    expect(screen.getByRole("navigation", { name: "页面板块导航" })).toBeInTheDocument();
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "location");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("概览");
  });

  it("moves aria-current on click and scrolls to the target", async () => {
    const user = userEvent.setup();
    // setup.ts mocks scrollIntoView on HTMLElement.prototype (shadows Element.prototype),
    // so the spy must land on the same prototype to observe the call.
    const scrollSpy = vi
      .spyOn(window.HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    renderWithSections();

    await user.click(screen.getByRole("link", { name: "教学详情" }));
    expect(screen.getByRole("link", { name: "教学详情" })).toHaveAttribute("aria-current", "location");
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("has no axe violations", async () => {
    const { container } = renderWithSections();
    expect(await axe(container)).toHaveNoViolations();
  });
});
