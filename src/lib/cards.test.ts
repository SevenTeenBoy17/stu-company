import { describe, expect, it } from "vitest";

import { questCardDeck } from "@/lib/content";
import { QUEST_CARD_RARITY_WEIGHTS, drawCard, type QuestCard } from "@/lib/cards";

const distributionDeck: QuestCard[] = [
  { id: "common-a", name: "普通 A", rarity: "common", artKey: "common-a", teachingLine: "普通卡。" },
  { id: "common-b", name: "普通 B", rarity: "common", artKey: "common-b", teachingLine: "普通卡。" },
  { id: "rare-a", name: "稀有 A", rarity: "rare", artKey: "rare-a", teachingLine: "稀有卡。" },
  { id: "rare-b", name: "稀有 B", rarity: "rare", artKey: "rare-b", teachingLine: "稀有卡。" },
  { id: "epic-a", name: "史诗 A", rarity: "epic", artKey: "epic-a", teachingLine: "史诗卡。" },
  { id: "epic-b", name: "史诗 B", rarity: "epic", artKey: "epic-b", teachingLine: "史诗卡。" },
];

describe("drawCard", () => {
  it("returns the same card for the same deck, owned set, and seed", () => {
    const first = drawCard(questCardDeck, ["calm-observer"], 20260618);
    const second = drawCard(questCardDeck, ["calm-observer"], 20260618);

    expect(second).toEqual(first);
  });

  it("biases away from already-owned cards when an unowned card exists in the selected rarity", () => {
    const deck: QuestCard[] = [
      { id: "owned", name: "已拥有", rarity: "common", artKey: "owned", teachingLine: "旧卡。" },
      { id: "fresh", name: "新卡", rarity: "common", artKey: "fresh", teachingLine: "新卡。" },
    ];

    expect(drawCard(deck, ["owned"], 7).id).toBe("fresh");
  });

  it("roughly follows the configured rarity weights over many deterministic seeds", () => {
    const counts = { common: 0, rare: 0, epic: 0 };

    for (let seed = 1; seed <= 2000; seed += 1) {
      counts[drawCard(distributionDeck, [], seed).rarity] += 1;
    }

    const commonShare = counts.common / 2000;
    const rareShare = counts.rare / 2000;
    const epicShare = counts.epic / 2000;

    expect(QUEST_CARD_RARITY_WEIGHTS.common).toBeGreaterThan(QUEST_CARD_RARITY_WEIGHTS.rare);
    expect(QUEST_CARD_RARITY_WEIGHTS.rare).toBeGreaterThan(QUEST_CARD_RARITY_WEIGHTS.epic);
    expect(commonShare).toBeGreaterThan(0.6);
    expect(commonShare).toBeLessThan(0.8);
    expect(rareShare).toBeGreaterThan(0.15);
    expect(rareShare).toBeLessThan(0.35);
    expect(epicShare).toBeGreaterThan(0.02);
    expect(epicShare).toBeLessThan(0.12);
  });
});
