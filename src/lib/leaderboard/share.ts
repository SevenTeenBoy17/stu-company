/**
 * Copyable financial-learning share card text (mirrors buildPersonaShareText).
 * Leads with the anti-YOLO message so the share is about decision quality, not
 * net worth or ranking pressure.
 */
export interface PowerShareInput {
  power: number;
  tierName: string;
  ranks: { school?: number; city?: number; province?: number; nation?: number };
}

export function buildPowerShareText(input: PowerShareInput): string {
  const bits: string[] = [];
  if (input.ranks.school) bits.push(`校内第 ${input.ranks.school}`);
  if (input.ranks.city) bits.push(`全市第 ${input.ranks.city}`);
  if (input.ranks.province) bits.push(`全省第 ${input.ranks.province}`);
  if (input.ranks.nation) bits.push(`全国第 ${input.ranks.nation}`);

  return [
    `我在 Mr.Brown 经济沙盘生成了 ${input.power} 点学习记录（${input.tierName}）！`,
    bits.length > 0 ? bits.join(" · ") : "刚生成学习记录，继续解锁成长区间 🌱",
    "看的是决策质量和复盘习惯，不是谁更敢赌。来生成你的财商学习画像 👉",
  ].join("\n");
}
