import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

import { StatCard } from "./stat-card";

describe("StatCard (v2 信息收敛)", () => {
  it("SSR-renders the final formatted value with count-up data attributes", () => {
    render(<StatCard label="账户净值" value={128500} format="currency" prefix="￥" />);
    const value = screen.getByText("￥128,500");
    expect(value).toHaveAttribute("data-motion-number");
    expect(value).toHaveAttribute("data-motion-value", "128500");
    expect(value).toHaveAttribute("data-motion-format", "currency");
  });

  it("renders hint and extension children below the number", () => {
    render(
      <StatCard label="学习进度" value={62} format="percent" hint="较上周 +8%">
        <p>扩展详情</p>
      </StatCard>,
    );
    expect(screen.getByText("较上周 +8%")).toBeInTheDocument();
    expect(screen.getByText("扩展详情")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<StatCard label="回合" value={8} hint="共 12 回合" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
