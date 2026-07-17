// @vitest-environment node
//
// itest8 P1 回归护栏：一名学生恒定只有一条 scenario_run（赛季重玩是原地重置同一 row，见
// repo.resetSeasonRun "reset the user's run to a fresh seed (same row id)"）。
// user_id 的【唯一约束】是防止并发首屏 check-then-insert 建出重复 run 的硬保证——
// 若有人把它改回普通 index，onConflictDoNothing 会重新形同虚设（两条随机主键永不冲突），
// 重复 run 将导致 limit(1) 无序读写命中不同行=丢单/进度回退、赛季榜同名重复上榜（永久损坏）。
// 这里同时钉住 schema 声明与迁移文件，任何一边被回退都会让 CI 立刻失败。

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSrc = fs.readFileSync(path.join(root, "src", "lib", "db", "schema.ts"), "utf8");
const repoSrc = fs.readFileSync(path.join(root, "src", "lib", "db", "repo.ts"), "utf8");

describe("scenario_runs.user_id 唯一性护栏 (itest8 P1)", () => {
  it("schema.ts 用 uniqueIndex（而非普通 index）声明 scenario_runs.user_id", () => {
    expect(schemaSrc).toMatch(/uniqueIndex\(\s*"scenario_runs_user_id_key"\s*\)\.on\(table\.userId\)/);
    // 不得同时存在旧的非唯一索引声明。
    expect(schemaSrc).not.toMatch(/index\(\s*"scenario_runs_user_id_idx"\s*\)\.on\(table\.userId\)/);
  });

  it("存在建立该唯一索引的迁移文件", () => {
    const migrations = fs
      .readdirSync(path.join(root, "drizzle"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => fs.readFileSync(path.join(root, "drizzle", f), "utf8"))
      .join("\n");
    expect(migrations).toMatch(/CREATE UNIQUE INDEX[\s\S]*?scenario_runs_user_id_key[\s\S]*?scenario_runs/i);
  });

  it("ensureStudentSandbox 的初始化 insert 以 user_id 为冲突目标（空目标只对随机主键生效=失效）", () => {
    expect(repoSrc).toMatch(/onConflictDoNothing\(\s*\{\s*target:\s*scenarioRuns\.userId\s*\}\s*\)/);
  });
});
