import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SeasonLeaderboard } from "@/components/student/season-leaderboard";

// itest8 渲染护栏：本组件被 itest7 P1 整体重写（payload 换成 PublicSeasonLeaderboardEntry：剥离
// userId/classroomId、改用服务端 isViewer、React key 用 rank），但此前只有 tsc/API 探针/单测，
// 从未真渲染过——渲染崩溃或文案与新作用域不符都没有任何测试能拦。这里补齐 CI 级护栏。

type Entry = { rank: number; name: string; netWorth: number; disciplineScore: number; isViewer: boolean };

function mockFetch(payload: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, json: async () => payload }),
  );
}

const board: { seasonKey: string; leaderboard: Entry[] } = {
  seasonKey: "S27",
  leaderboard: [
    { rank: 1, name: "林知夏", netWorth: 125074, disciplineScore: 80, isViewer: true },
    { rank: 2, name: "周明远", netWorth: 123328, disciplineScore: 70, isViewer: false },
  ],
};

describe("SeasonLeaderboard 渲染护栏 (itest8)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("用新 payload 形状渲染本班榜单：赛季号/姓名/净值，且 isViewer 行标「（你）」", async () => {
    mockFetch(board);
    render(<SeasonLeaderboard />);
    await waitFor(() => expect(screen.getByText("周明远")).toBeInTheDocument());
    expect(screen.getByText("S27")).toBeInTheDocument();
    expect(screen.getByText(/林知夏/)).toBeInTheDocument();
    // 自我高亮改用服务端 isViewer（不再依赖已剥离的 userId）。
    expect(screen.getByText(/（你）/)).toBeInTheDocument();
    expect(screen.getByText(/125,074/)).toBeInTheDocument();
  });

  it("文案必须与「班级作用域」一致——不得再宣称「本周所有玩家」(itest8 浏览器复验回归)", async () => {
    mockFetch(board);
    render(<SeasonLeaderboard />);
    await waitFor(() => expect(screen.getByText("周明远")).toBeInTheDocument());
    expect(screen.getByText(/本班同学本周面对同一套行情/)).toBeInTheDocument();
    expect(screen.queryByText(/本周所有玩家/)).toBeNull();
  });

  it("isViewer 且进入前三时给出鼓励提示", async () => {
    mockFetch(board);
    render(<SeasonLeaderboard />);
    await waitFor(() => expect(screen.getByText(/本周你的复盘表现很稳定/)).toBeInTheDocument());
  });

  it("空榜显示引导态而非崩溃", async () => {
    mockFetch({ seasonKey: "S27", leaderboard: [] });
    render(<SeasonLeaderboard />);
    await waitFor(() => expect(screen.getByText(/本周赛季刚开始/)).toBeInTheDocument());
  });

  it("请求失败显示中文错误 + 重新加载按钮", async () => {
    mockFetch({ message: "本周赛季榜暂时加载失败，请稍后重试。" }, false);
    render(<SeasonLeaderboard />);
    await waitFor(() => expect(screen.getByText(/本周赛季榜暂时加载失败/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /重新加载赛季榜/ })).toBeInTheDocument();
  });
});
