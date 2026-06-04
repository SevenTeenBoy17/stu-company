import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { MoneyInlineText, MoneyText } from "./money-text";

// First component test in the repo (breaks the 0-`.test.tsx` gap, TEST-STRATEGY §1.5 P0).
// Ground truth: money is ALWAYS rendered with `tabular-nums` and the up/positive red
// palette — the Chinese-market color convention documented in CLAUDE.md.

describe("MoneyText", () => {
  it("renders its children verbatim", () => {
    render(<MoneyText>¥120,000</MoneyText>);
    expect(screen.getByText("¥120,000")).toBeInTheDocument();
  });

  it("always carries the money-display classes (tabular-nums / extrabold / nowrap)", () => {
    render(<MoneyText>¥1,234</MoneyText>);
    const el = screen.getByText("¥1,234");
    expect(el).toHaveClass("tabular-nums");
    expect(el).toHaveClass("font-extrabold");
    expect(el).toHaveClass("whitespace-nowrap");
  });

  it("uses the light-surface red palette by default (red = up/positive)", () => {
    render(<MoneyText>¥1</MoneyText>);
    expect(screen.getByText("¥1")).toHaveClass("text-[#d43c33]");
  });

  it("uses the dark-surface red palette when tone='dark'", () => {
    render(<MoneyText tone="dark">¥1</MoneyText>);
    expect(screen.getByText("¥1")).toHaveClass("text-[#ffb7af]");
  });

  it("merges a caller-supplied className", () => {
    render(<MoneyText className="ml-2">¥1</MoneyText>);
    expect(screen.getByText("¥1")).toHaveClass("ml-2");
  });
});

describe("MoneyInlineText", () => {
  it("wraps a positive ¥ token in a tabular-nums MoneyText span", () => {
    render(<MoneyInlineText text="本月盈利 ¥12,000 太棒了" />);
    const money = screen.getByText("¥12,000");
    expect(money.tagName).toBe("SPAN");
    expect(money).toHaveClass("tabular-nums");
  });

  it("wraps a negative ¥ token too", () => {
    render(<MoneyInlineText text="亏损 -¥1,500 注意" />);
    expect(screen.getByText("-¥1,500")).toHaveClass("tabular-nums");
  });

  it("preserves the full surrounding text verbatim (no characters dropped)", () => {
    const text = "本月盈利 ¥12,000 太棒了";
    const { container } = render(<MoneyInlineText text={text} />);
    expect(container.textContent).toBe(text);
  });

  it("leaves text without a money token un-wrapped", () => {
    const { container } = render(<MoneyInlineText text="没有金额的文本" />);
    expect(container.querySelector(".tabular-nums")).toBeNull();
    expect(container.textContent).toBe("没有金额的文本");
  });
});
