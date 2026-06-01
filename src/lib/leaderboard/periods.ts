/**
 * Period keys for the leaderboard. Weekly reuses the season key so the weekly
 * board ranks exactly the cohort that faced the same weekly market seed (the
 * fair-comparison basis in season.ts). Monthly/season keys are ready for V2.
 *
 * NOTE (decision 4): the season key here is a placeholder semester heuristic
 * (H1 = Feb–Jul, H2 = Aug–Jan). Swap in real 校历 boundaries before the season
 * board ships in V2 — the user will provide the academic-calendar dates.
 */
import { currentSeasonKey } from "@/lib/season";
import type { RankPeriod } from "@/lib/types";

export function monthlyKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Placeholder semester key until real 校历 dates land (decision 4). */
export function semesterKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1..12
  if (month >= 2 && month <= 7) return `${y}H1`; // spring semester
  // Aug–Jan is the fall semester; Jan belongs to the prior year's fall.
  const academicYear = month === 1 ? y - 1 : y;
  return `${academicYear}H2`;
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
