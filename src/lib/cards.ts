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

export type QuestCardSeries = "foundations" | "risk-control" | "systems-thinking";

// 套系 = 学习单元（doc §2.1）。本牌库套系与稀有度一一对应：
// foundations(5 common) / risk-control(5 rare) / systems-thinking(2 epic)，
// 故由 rarity 派生，避免给 12 张卡 + 测试夹具逐一加字段；若未来套系与稀有度解耦再升级为独立字段。
const RARITY_TO_SERIES: Record<QuestCardRarity, QuestCardSeries> = {
  common: "foundations",
  rare: "risk-control",
  epic: "systems-thinking",
};

export const QUEST_CARD_SERIES_LABEL: Record<QuestCardSeries, string> = {
  foundations: "基础工具箱",
  "risk-control": "风险管理",
  "systems-thinking": "系统思维",
};

export function questCardSeries(card: Pick<QuestCard, "rarity">): QuestCardSeries {
  return RARITY_TO_SERIES[card.rarity];
}

export type SeriesProgress = {
  series: QuestCardSeries;
  label: string;
  owned: number;
  total: number;
  complete: boolean;
  missingNames: string[];
};

/**
 * 集卡套系进度（doc §2.2）：按套系分组、对照已拥有卡，给出 owned/total、是否集齐、缺失卡名。
 * 纯函数，无 IO。助推语义为「差 N 张→去完成对应任务」，不诱导「再抽」（抽取已确定性）。
 */
export function buildCollectionProgress(
  ownedCardIds: Iterable<string>,
  deck: readonly QuestCard[],
): SeriesProgress[] {
  const owned = new Set(ownedCardIds);
  const order: QuestCardSeries[] = ["foundations", "risk-control", "systems-thinking"];
  return order.map((series) => {
    const cards = deck.filter((card) => questCardSeries(card) === series);
    const missing = cards.filter((card) => !owned.has(card.id));
    return {
      series,
      label: QUEST_CARD_SERIES_LABEL[series],
      owned: cards.length - missing.length,
      total: cards.length,
      complete: cards.length > 0 && missing.length === 0,
      missingNames: missing.map((card) => card.name),
    };
  });
}
