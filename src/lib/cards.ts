export type QuestCardRarity = "common" | "rare" | "epic";

export type QuestCard = {
  id: string;
  name: string;
  rarity: QuestCardRarity;
  artKey: string;
  teachingLine: string;
};

/** FNV-1a string hash. Kept as a reusable, pure seed util (no ambient randomness/clock). */
export function seedFromString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * 去随机化（合规 · 面向未成年人）：按牌库顺序确定性领取「下一张未拥有」的卡。
 *
 * 不再用稀有度加权随机抽取——原实现 seed 含 user.id，导致「同一任务不同学生抽到不同稀有度」，
 * 把稀有度变成运气函数，是面向未成年人的盲盒/射幸暴露面。现在「完成多少任务 = 确定拥有哪些卡」，
 * 获得顺序对所有学生一致、可预期；卡牌仍各自保留 rarity 作为收藏分组语义（基础/进阶/典藏），
 * 但不再由抽取随机决定。集齐后回退到牌库首张（保持去重完形，便于补领时展示卡面）。
 */
export function drawCard(deck: readonly QuestCard[], ownedCardIds: Iterable<string>): QuestCard {
  if (deck.length === 0) {
    throw new Error("卡牌牌库为空，无法领取卡片。");
  }
  const owned = new Set(ownedCardIds);
  const nextUnowned = deck.find((card) => !owned.has(card.id));
  return nextUnowned ?? deck[0]!;
}
