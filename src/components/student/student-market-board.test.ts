import { describe, expect, it } from "vitest";

import {
  buildMarketKlineSummary,
  buildMarketRadarSummary,
  buildMarketSectorSummary,
} from "./student-market-board";

describe("student market chart summaries", () => {
  it("summarizes the selected stock kline in readable teaching language", () => {
    const summary = buildMarketKlineSummary({
      name: "美光科技",
      symbol: "MU",
      currentPrice: 439.15,
      changePercent: 2.95,
      miniSeries: [420, 425, 432, 439],
      candles: [
        { time: "1", open: 420, high: 428, low: 418, close: 426 },
        { time: "2", open: 426, high: 433, low: 424, close: 430 },
        { time: "3", open: 430, high: 442, low: 429, close: 439 },
      ],
    });

    expect(summary).toContain("美光科技（MU）");
    expect(summary).toContain("当前价格 439.15");
    expect(summary).toContain("日内上涨 2.95%");
    expect(summary).toContain("最近 3 根K线中 3 根收涨");
    expect(summary).toContain("不代表真实交易信号");
  });

  it("summarizes radar strengths and watch points without relying on shape alone", () => {
    const summary = buildMarketRadarSummary("美光科技", [
      { id: "momentum", label: "价格动量", score: 80, note: "短期趋势偏强。" },
      { id: "risk", label: "波动风险", score: 47, note: "波动需要记录。" },
      { id: "ai", label: "AI相关度", score: 84, note: "主题关联较高。" },
    ]);

    expect(summary).toContain("最强项是AI相关度（84）");
    expect(summary).toContain("需要重点复核的是波动风险（47）");
    expect(summary).toContain("结合右侧说明写出证据");
  });

  it("summarizes sector heat as a text alternative to the donut/bar visuals", () => {
    const summary = buildMarketSectorSummary([
      { id: "cloud", label: "云与企业软件", changePercent: 3.93, leadSymbol: "ORCL" },
      { id: "auto", label: "汽车与机器人", changePercent: -1.24, leadSymbol: "TSLA" },
      { id: "ai", label: "AI平台", changePercent: 2.51, leadSymbol: "META" },
    ]);

    expect(summary).toContain("观察池覆盖 3 个板块");
    expect(summary).toContain("当前最强的是云与企业软件");
    expect(summary).toContain("上涨 3.93%");
    expect(summary).toContain("最弱的是汽车与机器人");
    expect(summary).toContain("下跌 1.24%");
  });
});
