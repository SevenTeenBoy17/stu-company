# PR #18 生产部署清单（itest5–8 硬化合集）

> `feat/itest6-clickthrough-qa` → `main` 合并前后按此清单执行。唯一的强前置是**数据库迁移 0021**；`CRON_SECRET` 偏短只告警不阻断启动（无宕机风险）。

## 部署前置

### 1. `CRON_SECRET` 建议 ≥ 32 位（非阻断，只告警）
- `src/lib/env.ts` 在 production 下若 `CRON_SECRET` < 32 位会打启动**警告**（不再硬失败、不阻断 boot——一个弱 cron 令牌不值得让整站宕机）。
- **动作（建议、非强制）**：择机把 `CRON_SECRET` 轮换为 ≥32 位随机串（`openssl rand -hex 24`）并更新 Vercel Cron 配置。cron 路由用 `crypto.timingSafeEqual` 比较。

### 2. 数据库迁移 `0021_scenario_run_user_unique`（强前置）
- 给 `scenario_runs.user_id` 加**唯一索引**（itest8 P1：并发首屏防重复 run）。
- **动作**：`npm run db:migrate`（canonical，勿用 `drizzle-kit push`）。
- ⚠️ **若失败并报 `unique_violation`**：说明生产库已因旧 bug 存在重复 run。迁移**故意不自动删数据**。先手动去重（保留最进阶的一条），再重跑迁移：
  ```sql
  -- 先查有多少重复
  SELECT user_id, count(*) FROM scenario_runs GROUP BY user_id HAVING count(*) > 1;
  -- 去重（保留 net_worth 最高、id 最大的一条）
  DELETE FROM scenario_runs a USING scenario_runs b
  WHERE a.user_id = b.user_id AND (a.net_worth, a.id) < (b.net_worth, b.id);
  ```

### 3. RLS 策略（仅当 `DATABASE_ROLE=authenticated` 时才生效，但建议一并应用）
- itest8 P3 给 `profiles` / `ai_messages` 补了 `enable row level security`（此前有策略却漏 enable）。
- **动作**：`npm run db:apply-policies`（应用 `drizzle/policies.sql`）。默认 `owner` 连接会 bypass RLS，故不影响现网读写；应用后横向越权防线在 authenticated 角色下才闭合。

## 部署（Vercel 自动）
- 合并 `main` 后 Vercel 自动构建部署。构建前确认前置 1 已完成，否则 boot 失败。

## 部署后验证
- [ ] `GET /` `/student` `/teacher` `/parent` `/admin` 正常（无 500）。
- [ ] Cron 鉴权：`curl -H "Authorization: Bearer <错误值>" $APP_URL/api/cron/weekly-report` → 401；正确值 → 200。
- [ ] 赛季榜**行为变更**（itest7）：现为**本班作用域**（不再全局跨校），且响应体不含 `userId/classroomId`、隐身文案已改为「不进入财商战力榜」。给老师/运营同步这一产品变化。
- [ ] 畸形请求体：`curl -X POST $APP_URL/api/sim/actions -d 'x{{{'` → `{"error":"invalid_input","message":"请求格式不正确…"}`（中文，非英文 V8 错误）。
- [ ] 邀请码校验：连打 `/api/invites/validate` 会限流 429；响应仅 `{valid, role}`。
- [ ] `[repo.fallback]` 日志：正常业务拒绝（如「本回合已执行」）**不再**出现该 SLI 行。

## 行为变更摘要（给非工程同事）
- **赛季榜**：从「本周所有玩家（跨校）」改为「本班同学本周同一套行情」——跨校竞技请看**财商战力榜**（`/student/rank`，本就有别名+隐身治理）。
- **隐私**：赛季榜不再向前端暴露任何学生的内部 id；「隐身」只影响财商战力榜。
- **首页股票跑马灯**：兜底（教学示意）行情的免责标注现在移动端也可见。

## 回滚
- 代码回滚：revert 合并提交即可。
- 迁移 0021 是加唯一索引；如需回滚：`DROP INDEX scenario_runs_user_id_key;`（数据无损）。`CRON_SECRET` 轮换无需回滚。
