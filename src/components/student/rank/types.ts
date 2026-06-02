import type { RankScope } from "@/lib/leaderboard/ranking";
import type { RankPeriod, RankVisibility } from "@/lib/types";

export type { RankScope };
export type { RankPeriod, RankVisibility };

export interface TierInfoDTO {
  tier: number;
  key: string;
  name: string;
  min: number;
}

export interface ComponentsDTO {
  riskAdjReturn: number;
  discipline: number;
  drawdown: number;
  learning: number;
  growth: number;
}

export interface PowerCardDTO {
  period: RankPeriod;
  periodKey: string;
  hasProfile: boolean;
  ranked: boolean;
  alias?: string;
  visibility?: RankVisibility;
  consent?: number;
  power: number;
  tier: TierInfoDTO;
  toNextTier: number;
  components?: ComponentsDTO;
  ranks: Record<RankScope, number | undefined>;
}

export interface FormulaDTO {
  weights: ComponentsDTO;
  tiers: { tier: number; name: string; min: number }[];
  maxPower: number;
}

export interface BoardEntryDTO {
  userId: string;
  alias: string;
  power: number;
  tier: number;
  schoolId: string;
  schoolName: string;
  cityCode: string;
  provinceCode: string;
  visibility: RankVisibility;
  rank: number;
  isViewer: boolean;
}

export interface BoardDTO {
  scope: RankScope;
  period: RankPeriod;
  periodKey: string;
  total: number;
  viewerRank?: number;
  page: number;
  pageSize: number;
  entries: BoardEntryDTO[];
}

export const SCOPE_LABELS: Record<RankScope, string> = {
  school: "校内",
  city: "地级市",
  province: "全省",
  nation: "全国",
};

export const PERIOD_LABELS: Record<RankPeriod, string> = {
  weekly: "周榜",
  monthly: "月榜",
  season: "赛季榜",
};

export const COMPONENT_LABELS: Record<keyof ComponentsDTO, string> = {
  riskAdjReturn: "风险调整收益",
  discipline: "投资纪律",
  drawdown: "回撤控制",
  learning: "学习进度",
  growth: "资产成长",
};
