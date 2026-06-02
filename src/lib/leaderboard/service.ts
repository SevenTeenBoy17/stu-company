/**
 * Leaderboard read service — the bridge API routes call. Loads joined rank
 * snapshots via repo (DB JOIN with in-memory fallback) and runs the pure ranker
 * (ranking.ts) to produce boards + the per-player power card. All scope/identity
 * comes from the live rank profile so visibility changes apply immediately.
 */
import {
  getLearningProgress,
  getPowerSnapshot,
  getRankProfile,
  getRunForUser,
  listRankedUserIds,
  listRankSnapshots,
  upsertLeaderboardSnapshot,
} from "@/lib/db/repo";
import type { PowerComponentsRecord, RankPeriod, RankVisibility } from "@/lib/types";

import { periodKey, seasonLabel, semesterKey } from "./periods";
import { computePowerScore, POWER_WEIGHTS } from "./power-score";
import { runToPowerInput, type LearningProgress } from "./run-power";
import {
  rankLeaderboard,
  viewerPrivateRanks,
  type RankScope,
  type RankedEntry,
  type Viewer,
} from "./ranking";
import { nextTierGap, POWER_TIERS, tierInfo } from "./tiers";

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
  /** Human season name for the current semester, e.g. "2026 春季赛季". */
  seasonName: string;
  hasProfile: boolean;
  ranked: boolean;
  alias?: string;
  visibility?: RankVisibility;
  consent?: number;
  power: number;
  tier: ReturnType<typeof tierInfo>;
  toNextTier: number;
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
  const seasonName = seasonLabel(semesterKey(opts.now));

  if (!profile) {
    return {
      period,
      periodKey: key,
      seasonName,
      hasProfile: false,
      ranked: false,
      power: 0,
      tier: tierInfo(1),
      toNextTier: nextTierGap(0, 1),
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
  // Private ranks: the viewer's true position among all consented players in
  // scope, regardless of their own visibility — so a 隐身 player still sees
  // where they stand while staying off everyone else's board.
  const ranks = viewerPrivateRanks(snapshots, viewer);

  return {
    period,
    periodKey: key,
    seasonName,
    hasProfile: true,
    ranked: Boolean(own),
    alias: profile.alias,
    visibility: profile.visibility,
    consent: profile.consent,
    power,
    tier: tierInfo(own?.tier ?? 1),
    toNextTier: nextTierGap(power, own?.tier ?? 1),
    components: own?.components,
    ranks,
  };
}

// All boards are refreshed live as students play. Season uses the 校历-aligned
// semester key (periods.ts, decision 4); adjust the two boundary months there if
// a school's calendar differs.
const STANDING_PERIODS: RankPeriod[] = ["weekly", "monthly", "season"];

/**
 * Recompute and persist a user's power from their current run, into every live
 * board (weekly + monthly). Power is computed once and written to each bucket;
 * the soft floor is semester-scoped so the repeated writes are idempotent on the
 * tier. Called after a round advances and on onboarding. No run -> no-op
 * (returns null) so callers can ignore it for non-students.
 */
export async function recomputePowerForUser(
  userId: string,
  opts: { now?: Date; learning?: LearningProgress } = {},
): Promise<{ power: number } | null> {
  const run = await getRunForUser(userId);
  if (!run) return null;
  // Pull the student's real lesson completion into the learning component
  // (defaults to whatever the caller passes, e.g. in tests).
  const learning = opts.learning ?? (await getLearningProgress(userId));
  const input = runToPowerInput(run, learning);
  const { power, components } = computePowerScore(input);
  const netWorth = Math.round(input.netWorth);
  const seasonKey = semesterKey(opts.now);
  for (const period of STANDING_PERIODS) {
    await upsertLeaderboardSnapshot({
      userId,
      period,
      periodKey: periodKey(period, opts.now),
      power,
      netWorth,
      components,
      seasonKey,
    });
  }
  return { power };
}

/**
 * Recompute every onboarded user (the daily cron). Keeps boards fresh and, at a
 * season boundary, applies the soft-floor reset to inactive students too.
 */
export async function recomputeAllRankedUsers(
  opts: { now?: Date } = {},
): Promise<{ processed: number }> {
  const userIds = await listRankedUserIds();
  let processed = 0;
  for (const userId of userIds) {
    const result = await recomputePowerForUser(userId, opts);
    if (result) processed += 1;
  }
  return { processed };
}

/** Static description of the scoring formula for the transparency panel (decision 1). */
export function powerFormula() {
  return {
    weights: POWER_WEIGHTS,
    tiers: POWER_TIERS.map((t) => ({ tier: t.tier, name: t.name, min: t.min })),
    maxPower: 2000,
  };
}
