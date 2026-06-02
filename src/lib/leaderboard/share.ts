/**
 * Copyable 财商战力 share card text (mirrors buildPersonaShareText). Leads with
 * the anti-YOLO message so the brag is about decision quality, not net worth.
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
    `我在 Mr.Brown 经济沙盘的财商战力是 ${input.power}（${input.tierName}）！`,
    bits.length > 0 ? bits.join(" · ") : "刚生成战力，目标冲段位 🚀",
    "比的是决策质量，不是谁更敢赌。来测测你的财商战力 👉",
  ].join("\n");
}
