/**
 * Pure leaderboard ranking over snapshots — the reference logic used by the
 * in-memory store and mirrored by the SQL window-function path (RANK() OVER
 * PARTITION BY scope). Scopes: school / city / province / nation (王者-style
 * "校第X · 市第X · 省第X · 全国第X").
 *
 * Privacy (decision 3): `hidden` opts fully out (not ranked, not shown);
 * `school_only` appears only in the school scope; `public` everywhere. Ranks are
 * computed over exactly the displayed set, so there are no rank gaps that could
 * leak who hid.
 */
export type RankScope = "school" | "city" | "province" | "nation";
export type RankVisibility = "public" | "school_only" | "hidden";

export interface RankSnapshot {
  userId: string;
  alias: string;
  power: number;
  tier: number;
  schoolId: string;
  schoolName: string;
  cityCode: string;
  cityName?: string;
  provinceCode: string;
  visibility: RankVisibility;
}

export interface Viewer {
  userId: string;
  schoolId: string;
  cityCode: string;
  provinceCode: string;
}

export interface RankedEntry extends RankSnapshot {
  rank: number;
  isViewer: boolean;
}

export interface RankResult {
  entries: RankedEntry[];
  total: number;
  viewerRank?: number;
  page: number;
  pageSize: number;
}

function inScope(s: RankSnapshot, scope: RankScope, viewer: Viewer): boolean {
  switch (scope) {
    case "school":
      return s.schoolId === viewer.schoolId;
    case "city":
      return s.cityCode === viewer.cityCode;
    case "province":
      return s.provinceCode === viewer.provinceCode;
    case "nation":
      return true;
  }
}

function visibleIn(s: RankSnapshot, scope: RankScope): boolean {
  if (s.visibility === "hidden") return false;
  if (s.visibility === "school_only") return scope === "school";
  return true;
}

/** Deterministic order: power desc, then userId asc to break ties stably. */
function byPowerDesc(a: RankSnapshot, b: RankSnapshot): number {
  if (b.power !== a.power) return b.power - a.power;
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

export function rankLeaderboard(
  snapshots: RankSnapshot[],
  scope: RankScope,
  viewer: Viewer,
  opts: { page?: number; pageSize?: number } = {},
): RankResult {
  const eligible = snapshots
    .filter((s) => inScope(s, scope, viewer) && visibleIn(s, scope))
    .sort(byPowerDesc);

  const total = eligible.length;
  const viewerIdx = eligible.findIndex((s) => s.userId === viewer.userId);
  const viewerRank = viewerIdx >= 0 ? viewerIdx + 1 : undefined;

  const pageSize = Math.max(1, opts.pageSize ?? 50);
  const page = Math.max(1, opts.page ?? 1);
  const start = (page - 1) * pageSize;

  const entries: RankedEntry[] = eligible.slice(start, start + pageSize).map((s, i) => ({
    ...s,
    rank: start + i + 1,
    isViewer: s.userId === viewer.userId,
  }));

  return { entries, total, viewerRank, page, pageSize };
}

/** The viewer's rank in all four scopes, honouring visibility (board-consistent). */
export function viewerScopeRanks(
  snapshots: RankSnapshot[],
  viewer: Viewer,
): Record<RankScope, number | undefined> {
  const scopes: RankScope[] = ["school", "city", "province", "nation"];
  const result = {} as Record<RankScope, number | undefined>;
  for (const scope of scopes) {
    result[scope] = rankLeaderboard(snapshots, scope, viewer, { pageSize: 1 }).viewerRank;
  }
  return result;
}

/**
 * The viewer's *private* rank in all four scopes — their true competitive
 * position among every consented player in scope, ignoring visibility (and
 * including the viewer even when hidden). Used for the player's own card so a
 * 隐身 player still sees where they stand, while never appearing on others'
 * boards. Undefined when the viewer has no snapshot (not in the field).
 */
export function viewerPrivateRanks(
  snapshots: RankSnapshot[],
  viewer: Viewer,
): Record<RankScope, number | undefined> {
  const scopes: RankScope[] = ["school", "city", "province", "nation"];
  const empty = { school: undefined, city: undefined, province: undefined, nation: undefined };
  const self = snapshots.find((s) => s.userId === viewer.userId);
  if (!self) return { ...empty };

  const result = { ...empty } as Record<RankScope, number | undefined>;
  for (const scope of scopes) {
    const field = snapshots.filter((s) => inScope(s, scope, viewer));
    // Same ordering as the board: power desc, userId asc as the tie-break.
    const higher = field.filter(
      (s) => s.power > self.power || (s.power === self.power && s.userId < self.userId),
    ).length;
    result[scope] = higher + 1;
  }
  return result;
}
