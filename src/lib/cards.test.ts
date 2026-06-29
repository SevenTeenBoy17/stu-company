import { describe, expect, it } from "vitest";

import { questCardDeck } from "@/lib/content";
import { drawCard, type QuestCard } from "@/lib/cards";

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
