/**
 * Global weekly seasons (P2). Every ISO-ish week is a "season" with a shared,
 * deterministic seed so all new runs that week face the same market — making a
 * cross-student weekly leaderboard fair. Membership is derived from a run's
 * stored seed matching the current season seed (no extra column needed).
 */
const SEASON_EPOCH_MS = Date.UTC(2026, 0, 5); // Monday 2026-01-05
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function currentSeasonKey(now: Date = new Date()): string {
  const weeks = Math.floor((now.getTime() - SEASON_EPOCH_MS) / WEEK_MS);
  return `S${weeks}`;
}

export function seasonSeed(seasonKey: string): number {
  // FNV-1a hash → positive 31-bit int.
  let hash = 2166136261;
  for (let i = 0; i < seasonKey.length; i++) {
    hash ^= seasonKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 0x7fffffff || 1;
}

/** The seed every fair, on-leaderboard run uses this week. */
export function currentSeasonSeed(now: Date = new Date()): number {
  return seasonSeed(currentSeasonKey(now));
}
