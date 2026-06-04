# 财商战力榜 — 生产启用清单

> 合并 PR #4 只是把**代码**落到 main。战力榜要在生产真正可用，还需下面三步。
> **在此之前其余功能不受影响**——但学生访问 `/student/rank` 会失败（生产默认不走内存兜底，表不存在即 5xx）。所以**先迁移、后放量**。

## 1. 应用数据库迁移 0010–0012（必须，按序）

三张迁移引入战力榜的表：

| 迁移 | 内容 |
|---|---|
| `0010_leaderboard_power_rank` | `schools` / `rank_profiles` / `leaderboard_snapshots` |
| `0011_rank_profile_tier_season` | `rank_profiles.last_tier_season`（软地板按学期重置） |
| `0012_learning_progress` | `learning_progress`（学习打卡） |

**方式 A（推荐，drizzle journal 驱动）：**
```bash
# DATABASE_URL 指向目标库（先在 staging/分支库验证，再上生产）
DATABASE_URL="postgres://..." npx drizzle-kit migrate
```
drizzle 会按 `drizzle/meta/_journal.json` 只应用未执行过的迁移（0010–0012）。

**方式 B（手动）：** 在 Supabase SQL Editor 依次粘贴执行
`drizzle/0010_*.sql` → `0011_*.sql` → `0012_*.sql`。

> ⚠️ 务必先在**安全的开发/分支库**验证，再对生产库执行。本功能开发全程 in-memory，未对任何远端库执行过迁移。

## 2. 环境变量

| 变量 | 说明 |
|---|---|
| `CRON_SECRET` | **生产必填**。保护 `/api/cron/recompute-leaderboard`（每日 00:30，vercel.json 已注册）与既有 weekly-report。Vercel Cron 自动带 `Authorization: Bearer $CRON_SECRET`。 |

其余沿用现有 env（`DATABASE_URL` 等），无新增。

## 3. RLS（仅当 `DATABASE_ROLE=authenticated` + `withRls()` 时需要）

四张新表（`schools` / `rank_profiles` / `leaderboard_snapshots` / `learning_progress`）**尚未**在 `drizzle/policies.sql` 配 RLS 策略。

- **默认 `owner` 连接**：绕过 RLS，开箱可用（与现状一致，应用层 `repo.ts` 校验为主防线）。
- **若启用 authenticated 角色**：需为这四张表补 RLS 策略，否则查询被拒。属上线后续项，非阻塞。

## 验证（迁移后）
1. 学生登录 → 访问 `/student/rank` → 填学校地区入驻 → 看到战力卡与榜单。
2. 玩 1 局推进回合 → 战力刷新；`/learn` 学完打卡 → 学习分上升。
3. 手动触发 cron 验证：`curl -H "Authorization: Bearer $CRON_SECRET" https://<域名>/api/cron/recompute-leaderboard` → `{"processed":N}`。

## 回滚
代码回滚 = revert 合并提交。数据：三张迁移均为**新增**表/列，不改动既有数据；如需彻底回退可 `DROP TABLE learning_progress, leaderboard_snapshots, rank_profiles, schools;` 并删 `rank_profiles.last_tier_season`（仅在确无数据需保留时）。
