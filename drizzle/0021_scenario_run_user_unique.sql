-- Migration 0021: scenario_runs.user_id UNIQUE (itest8 P1)
-- Created: 2026-07-16
-- Context: 一名学生恒定只有一条 run —— 赛季重玩是原地重置同一 row（见 repo.resetSeasonRun，
--          "reset the user's run to a fresh seed (same row id)"）。此前 user_id 只有【非唯一】索引，
--          让并发首屏(Promise.all[getSimulationStateForUser, getPeerHeatForStudent]) 里两个独立事务
--          的 check-then-insert 各自建出一条 run（onConflictDoNothing 冲突目标只对随机主键生效、永不冲突）
--          → 同一 user 出现重复 run，limit(1) 无序读写命中不同行=丢单/进度回退、赛季榜同名重复上榜。
-- NOTE: 若此迁移以 unique_violation 失败，说明生产库已因旧 bug 存在重复 run，需先去重（保留最进阶的一条）：
--   DELETE FROM scenario_runs a USING scenario_runs b
--   WHERE a.user_id = b.user_id AND (a.net_worth, a.id) < (b.net_worth, b.id);
-- 故意不在迁移里自动 DELETE：宁可失败告警，也不静默删掉某个学生的 run。
DROP INDEX IF EXISTS "scenario_runs_user_id_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scenario_runs_user_id_key" ON "scenario_runs" ("user_id");
