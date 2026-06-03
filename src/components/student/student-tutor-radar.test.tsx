import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TutorRadarPayload } from "@/lib/types";

import { StudentTutorRadar } from "./student-tutor-radar";

function makePayload(over: Partial<TutorRadarPayload> = {}): TutorRadarPayload {
  return {
    asOf: "2026-06-01T00:00:00.000Z",
    provider: "fallback",
    summary: "你当前的节奏比较稳。",
    metrics: [
      { id: "m1", label: "风险控制", score: 82, note: "现金缓冲充足" },
      { id: "m2", label: "决策纪律", score: 55, note: "偶有冲动交易" },
    ],
    ...over,
  };
}

describe("StudentTutorRadar", () => {
  it("renders the summary and each metric label / score / note", () => {
    render(<StudentTutorRadar payload={makePayload()} onRefresh={() => {}} />);
    expect(screen.getByText("你当前的节奏比较稳。")).toBeInTheDocument();
    expect(screen.getByText("风险控制")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("偶有冲动交易")).toBeInTheDocument();
  });

  it("labels the provider as local for a fallback payload", () => {
    render(<StudentTutorRadar payload={makePayload({ provider: "fallback" })} onRefresh={() => {}} />);
    expect(screen.getByText(/本地规则生成维度/)).toBeInTheDocument();
  });

  it("labels the provider as remote when the model answered", () => {
    render(<StudentTutorRadar payload={makePayload({ provider: "remote" })} onRefresh={() => {}} />);
    expect(screen.getByText(/远端模型已生成维度/)).toBeInTheDocument();
  });

  it("shows the premium investor-persona card only when a persona is provided", () => {
    const { rerender } = render(<StudentTutorRadar payload={makePayload()} onRefresh={() => {}} />);
    expect(screen.queryByText("投资人格", { exact: false })).toBeNull();

    rerender(
      <StudentTutorRadar
        payload={makePayload()}
        persona={{ label: "稳健长跑者", summary: "你偏好低波动的稳健路径。" }}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText("稳健长跑者")).toBeInTheDocument();
  });

  it("calls onRefresh when the update button is clicked", async () => {
    const onRefresh = vi.fn();
    render(<StudentTutorRadar payload={makePayload()} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole("button", { name: /一键更新雷达图/ }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
