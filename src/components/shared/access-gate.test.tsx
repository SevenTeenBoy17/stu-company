import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AccessGate } from "./access-gate";

// Verifies the unauthenticated fallback panel surfaces the title/description and
// both recovery links (login + learn). TEST-STRATEGY §1.5 P0 (component break-zero).

describe("AccessGate", () => {
  it("renders the title as the level-1 heading", () => {
    render(<AccessGate title="需要登录后访问" description="请登录" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("需要登录后访问");
  });

  it("renders the description text", () => {
    render(<AccessGate title="标题" description="请先登录后再访问学生面板" />);
    expect(screen.getByText("请先登录后再访问学生面板")).toBeInTheDocument();
  });

  it("links to the demo login entry", () => {
    render(<AccessGate title="标题" description="描述" />);
    expect(screen.getByRole("link", { name: "前往试玩入口登录" })).toHaveAttribute(
      "href",
      "/demo",
    );
  });

  it("links to the learn catalog", () => {
    render(<AccessGate title="标题" description="描述" />);
    expect(screen.getByRole("link", { name: "先看课程模块" })).toHaveAttribute("href", "/learn");
  });
});
