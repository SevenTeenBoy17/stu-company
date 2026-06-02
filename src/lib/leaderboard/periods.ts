/**
 * Period keys for the leaderboard. Weekly reuses the season key so the weekly
 * board ranks exactly the cohort that faced the same weekly market seed (the
 * fair-comparison basis in season.ts).
 *
 * 校历 / season scheme (decision 4): one semester = one season, with the two
 * resets aligned to the two real term starts:
 *   - 秋季赛季 (Autumn): 9/1 – 1/31   key `<year>-A` (year = term start year)
 *   - 春季赛季 (Spring): 2/1 – 8/31   key `<year>-S` (summer break folds in, so
 *                                      students keep their 段位 all summer)
 * Only two boundary months matter (SPRING_START_MONTH, AUTUMN_START_MONTH);
 * adjust them if a school's 校历 differs. Resetting on term starts (not exact
 * exam dates) is the meaningful, nationally-consistent choice.
 */
import { currentSeasonKey } from "@/lib/season";
import type { RankPeriod } from "@/lib/types";

// Term-start boundaries (inclusive). Spring runs SPRING_START..(AUTUMN_START-1),
// autumn runs AUTUMN_START..(SPRING_START-1 of next year).
const SPRING_START_MONTH = 2; // 2月1日 春季学期开学
const AUTUMN_START_MONTH = 9; // 9月1日 秋季学期开学

export function monthlyKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Semester (赛季) key aligned to the 校历 term starts (decision 4). */
export function semesterKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1..12
  if (month >= SPRING_START_MONTH && month < AUTUMN_START_MONTH) return `${y}-S`; // 春季 (incl. summer)
  if (month >= AUTUMN_START_MONTH) return `${y}-A`; // 秋季 Sep–Dec
  return `${y - 1}-A`; // January belongs to the prior year's autumn season
}

/** Human label for a semester key, e.g. "2026-S" -> "2026 春季赛季". */
export function seasonLabel(key: string): string {
  const [year, term] = key.split("-");
  if (term === "S") return `${year} 春季赛季`;
  if (term === "A") return `${year} 秋季赛季`;
  return key;
}

export function periodKey(period: RankPeriod, now: Date = new Date()): string {
  switch (period) {
    case "weekly":
      return currentSeasonKey(now);
    case "monthly":
      return monthlyKey(now);
    case "season":
      return semesterKey(now);
  }
}
