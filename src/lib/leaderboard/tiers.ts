/**
 * Rank tiers (段位) for the financial-power leaderboard — King-of-Glory style,
 * themed to financial literacy. Power is 0..2000 (see power-score.ts).
 *
 * Decision 7: for 12–18 minors, tiers must never drop *within* a season
 * (`applySoftFloor`) to protect motivation; cross-season uses a gentle reset
 * handled elsewhere.
 */
export interface TierInfo {
  tier: number; // 1..6
  key: string;
  name: string; // 中文展示名
  min: number; // 该段位的战力下限（含）
}

export const POWER_TIERS: readonly TierInfo[] = [
  { tier: 1, key: "novice", name: "理财新手", min: 0 },
  { tier: 2, key: "steady", name: "稳健学徒", min: 400 },
  { tier: 3, key: "savvy", name: "精明投资者", min: 800 },
  { tier: 4, key: "strategist", name: "策略大师", min: 1200 },
  { tier: 5, key: "grandmaster", name: "财商宗师", min: 1600 },
  { tier: 6, key: "peak", name: "巅峰名人堂", min: 1900 },
] as const;

/** Map a power value to its tier number (1..6). Values below 0 clamp to tier 1. */
export function tierFromPower(power: number): number {
  let tier = 1;
  for (const info of POWER_TIERS) {
    if (power >= info.min) tier = info.tier;
  }
  return tier;
}

export function tierInfo(tier: number): TierInfo {
  return POWER_TIERS.find((info) => info.tier === tier) ?? POWER_TIERS[0];
}

/** Distance (in power points) to the next tier, or 0 if already at the top. */
export function powerToNextTier(power: number): number {
  const next = POWER_TIERS.find((info) => info.min > power);
  return next ? next.min - power : 0;
}

/**
 * Distance to the tier above the *displayed* tier. Needed because the soft floor
 * (decision 7) can hold a player's displayed tier above what their current power
 * alone implies; the "next tier" gap must be measured from the displayed tier so
 * the card stays consistent (e.g. a floor-held 策略大师 counts toward 财商宗师,
 * not back toward 策略大师). Returns 0 at the top tier.
 */
export function nextTierGap(power: number, displayedTier: number): number {
  const next = POWER_TIERS.find((info) => info.tier === displayedTier + 1);
  return next ? Math.max(0, next.min - power) : 0;
}

/**
 * Decision 7 soft floor: a student's tier never decreases within a season.
 * `prevTierThisSeason` is the highest tier they've held this season.
 */
export function applySoftFloor(prevTierThisSeason: number, newTier: number): number {
  return Math.max(prevTierThisSeason, newTier);
}
