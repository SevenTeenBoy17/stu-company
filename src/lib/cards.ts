export type QuestCardRarity = "common" | "rare" | "epic";

export type QuestCard = {
  id: string;
  name: string;
  rarity: QuestCardRarity;
  artKey: string;
  teachingLine: string;
};

export const QUEST_CARD_RARITY_WEIGHTS: Record<QuestCardRarity, number> = {
  common: 70,
  rare: 24,
  epic: 6,
};

const QUEST_CARD_RARITIES: QuestCardRarity[] = ["common", "rare", "epic"];

/** Deterministic PRNG (mulberry32). Keep this pure: no ambient randomness or clock access. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRarity(deck: readonly QuestCard[], rng: () => number): QuestCardRarity {
  const available = QUEST_CARD_RARITIES.filter((rarity) => deck.some((card) => card.rarity === rarity));
  const totalWeight = available.reduce((sum, rarity) => sum + QUEST_CARD_RARITY_WEIGHTS[rarity], 0);
  let roll = rng() * totalWeight;

  for (const rarity of available) {
    roll -= QUEST_CARD_RARITY_WEIGHTS[rarity];
    if (roll <= 0) return rarity;
  }

  return available.at(-1) ?? "common";
}

export function seedFromString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function drawCard(deck: readonly QuestCard[], ownedCardIds: Iterable<string>, seed: number): QuestCard {
  if (deck.length === 0) {
    throw new Error("卡牌牌库为空，无法抽卡。");
  }

  const rng = makeRng(seed);
  const owned = new Set(ownedCardIds);
  const rarity = pickRarity(deck, rng);
  const sameRarity = deck.filter((card) => card.rarity === rarity);
  const unownedSameRarity = sameRarity.filter((card) => !owned.has(card.id));
  const candidates = unownedSameRarity.length > 0 ? unownedSameRarity : sameRarity;
  const index = Math.floor(rng() * candidates.length);
  return candidates[index] ?? candidates[0]!;
}
