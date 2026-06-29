import { describe, expect, it } from "vitest";

import { questCardDeck } from "@/lib/content";
import { buildCollectionProgress, drawCard, type QuestCard } from "@/lib/cards";

const deck: QuestCard[] = [
  { id: "a", name: "甲", rarity: "common", artKey: "a", teachingLine: "卡甲。" },
  { id: "b", name: "乙", rarity: "rare", artKey: "b", teachingLine: "卡乙。" },
  { id: "c", name: "丙", rarity: "epic", artKey: "c", teachingLine: "卡丙。" },
];

describe("drawCard（确定性领取 · 去射幸）", () => {
  it("同一牌库与已拥有集合永远返回同一张卡（不依赖任何随机种子/用户身份）", () => {
    const first = drawCard(questCardDeck, ["calm-observer"]);
    const second = drawCard(questCardDeck, ["calm-observer"]);
    expect(second).toEqual(first);
  });

  it("按牌库顺序领取「下一张未拥有」的卡", () => {
    expect(drawCard(deck, []).id).toBe("a");
    expect(drawCard(deck, ["a"]).id).toBe("b");
    expect(drawCard(deck, ["a", "b"]).id).toBe("c");
  });

  it("完成多少任务 = 拥有多少卡：逐张领取覆盖整个牌库且不重复", () => {
    const owned: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < deck.length; i += 1) {
      const card = drawCard(deck, owned);
      expect(seen.has(card.id)).toBe(false);
      seen.add(card.id);
      owned.push(card.id);
    }
    expect(seen.size).toBe(deck.length);
  });

  it("集齐后回退到牌库首张（去重完形，便于补领展示）", () => {
    const allOwned = deck.map((card) => card.id);
    expect(drawCard(deck, allOwned).id).toBe("a");
  });

  it("空牌库抛出中文错误", () => {
    expect(() => drawCard([], [])).toThrow(/牌库为空/);
  });
});

describe("buildCollectionProgress（套系进度）", () => {
  it("按套系分组并对照已拥有卡（doc §2.1 的 5/5/2 拆分）", () => {
    const progress = buildCollectionProgress([], questCardDeck);
    expect(progress.map((s) => s.series)).toEqual(["foundations", "risk-control", "systems-thinking"]);
    expect(progress.map((s) => s.total)).toEqual([5, 5, 2]);
    expect(progress.every((s) => s.owned === 0 && !s.complete)).toBe(true);
  });

  it("集齐某套系 → complete=true 且 missingNames 为空", () => {
    const foundations = questCardDeck.filter((card) => card.rarity === "common").map((card) => card.id);
    const f = buildCollectionProgress(foundations, questCardDeck).find((s) => s.series === "foundations")!;
    expect(f.owned).toBe(5);
    expect(f.complete).toBe(true);
    expect(f.missingNames).toEqual([]);
  });

  it("差 N 张时给出缺失卡名（用于定向助推「去完成对应任务」，非诱导再抽）", () => {
    const allButOne = questCardDeck.map((card) => card.id).slice(1);
    const progress = buildCollectionProgress(allButOne, questCardDeck);
    const missingTotal = progress.reduce((sum, s) => sum + s.missingNames.length, 0);
    expect(missingTotal).toBe(1);
  });
});
