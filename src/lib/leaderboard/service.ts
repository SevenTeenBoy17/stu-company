/**
 * Leaderboard read service — the bridge API routes call. Loads joined rank
 * snapshots via repo (DB JOIN with in-memory fallback) and runs the pure ranker
 * (ranking.ts) to produce boards + the per-player power card. All scope/identity
 * comes from the live rank profile so visibility changes apply immediately.
 */
import {
  getPowerSnapshot,
  getRankProfile,
  getRunForUser,
  listRankSnapshots,
  upsertLeaderboardSnapshot,
} from "@/lib/db/repo";
import type { PowerComponentsRecord, RankPeriod } from "@/lib/types";

import { periodKey } from "./periods";
import { computePowerScore, POWER_WEIGHTS } from "./power-score";
import { runToPowerInput, type LearningProgress } from "./run-power";
import {
  rankLeaderboard,
  viewerScopeRanks,
  type RankScope,
  type RankedEntry,
  type Viewer,
} from "./ranking";
import { POWER_TIERS, powerToNextTier, tierInfo } from "./tiers";

export interface LeaderboardBoard {
  scope: RankScope;
  period: RankPeriod;
  periodKey: string;
  total: number;
  viewerRank?: number;
  page: number;
  pageSize: number;
  entries: RankedEntry[];
}

export interface PowerCard {
  period: RankPeriod;
  periodKey: string;
  hasProfile: boolean;
  ranked: boolean;
  alias?: string;
  power: number;
  tier: ReturnType<typeof tierInfo>;
  toNextTier: ReturnType<typeof powerToNextTier>;
  components?: PowerComponentsRecord;
  ranks: Record<RankScope, number | undefined>;
}

async function viewerFor(userId: string): Promise<Viewer | null> {
  const profile = await getRankProfile(userId);
  if (!profile) return null;
  return {
    userId,
    schoolId: profile.schoolId,
    cityCode: profile.cityCode,
    provinceCode: profile.provinceCode,
  };
}

export async function getLeaderboardBoard(
  userId: string,
  scope: RankScope,
  period: RankPeriod,
  opts: { page?: number; pageSize?: number; now?: Date } = {},
): Promise<LeaderboardBoard | null> {
  const viewer = await viewerFor(userId);
  if (!viewer) return null;
  const key = periodKey(period, opts.now);
  const snapshots = await listRankSnapshots(period, key);
  const result = rankLeaderboard(snapshots, scope, viewer, {
    page: opts.page,
    pageSize: opts.pageSize,
  });
  return { scope, period, periodKey: key, ...result };
}

export async function getPowerCard(
  userId: string,
  period: RankPeriod = "weekly",
  opts: { now?: Date } = {},
): Promise<PowerCard> {
  const profile = await getRankProfile(userId);
  const key = periodKey(period, opts.now);

  if (!profile) {
    return {
      period,
      periodKey: key,
      hasProfile: false,
      ranked: false,
      power: 0,
      tier: tierInfo(1),
      toNextTier: powerToNextTier(0),
      ranks: { school: undefined, city: undefined, province: undefined, nation: undefined },
    };
  }

  // The player's own snapshot is read directly so the card works even when
  // they're hidden/unconsented (the card is private to them). Ranks still come
  // from the consented, visible set, so they're undefined until the player opts
  // in — the card copy explains how to appear on the board.
  const [own, snapshots] = await Promise.all([
    getPowerSnapshot(userId, period, key),
    listRankSnapshots(period, key),
  ]);
  const viewer: Viewer = {
    userId,
    schoolId: profile.schoolId,
    cityCode: profile.cityCode,
    provinceCode: profile.provinceCode,
  };
  const power = own?.power ?? 0;
  const ranks = viewerScopeRanks(snapshots, viewer);

  return {
    period,
    periodKey: key,
    hasProfile: true,
    ranked: Boolean(own),
    alias: profile.alias,
    power,
    tier: tierInfo(own?.tier ?? 1),
    toNextTier: powerToNextTier(power),
    components: own?.components,
    ranks,
  };
}

/**
 * Recompute and persist a user's power for a period from their current run.
 * Called after a round advances and on onboarding. No run -> no-op (returns
 * null) so callers can ignore it for non-students.
 */
export async function recomputePowerForUser(
  userId: string,
  period: RankPeriod = "weekly",
  opts: { now?: Date; learning?: LearningProgress } = {},
): Promise<{ power: number } | null> {
  const run = await getRunForUser(userId);
  if (!run) return null;
  const input = runToPowerInput(run, opts.learning);
  const { power, components } = computePowerScore(input);
  await upsertLeaderboardSnapshot({
    userId,
    period,
    periodKey: periodKey(period, opts.now),
    power,
    netWorth: Math.round(input.netWorth),
    components,
  });
  return { power };
}

/** Static description of the scoring formula for the transparency panel (decision 1). */
export function powerFormula() {
  return {
    weights: POWER_WEIGHTS,
    tiers: POWER_TIERS.map((t) => ({ tier: t.tier, name: t.name, min: t.min })),
    maxPower: 2000,
  };
}
