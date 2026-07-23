# UI v3 · 学生端实施与验收日志（2026-07-21）

> 分支 `feat/student-ui-v3`。落地 `docs/ui-v3/01-student-text-audit.md` 的 **31 条**可落地裁决 + **6 张** `public/brand/v3/` 素材。
> 本轮范围：仅学生端 9 个登录后页（11 组件，`git status` 全为 M）；未动 API / DB / auth / AI 网关。视觉验收禁改产品源码，仅新增脚本+文档。

## 31 条落地（按页 · 沿用审计编号）
| 页 | 组件 | 落地条数 | 裁决拆分 |
| --- | --- | ---: | --- |
| risk-profile | `student-risk-profile-dashboard` | 9 · RP1–9 | 图形化×1 折×4 删×3 图文卡×1 |
| quests | `student-quest-dashboard` | 4 · Q1–4 | 删×4 |
| history | `student-history-review-dashboard` | 3 · HI1–3 | 删×3 |
| student 首页 | `allocation-panel`/`home-hub`/`sandbox` | 4 · H1–4 | 折×1 删×3 |
| wealth | `student-wealth-dashboard` | 2 · W1–2 | 图文卡×1 图形化×1 |
| market | `student-market-board` | 3 · M1–3 | 删×2 图文卡×1 |
| life | `student-life-cashflow-dashboard` | 3 · L1–3 | 折×2 删×1 |
| auto-invest | `student-auto-invest-dashboard` | 2 · AI2–3 | 删×2 |
| credit | `student-credit-lab-dashboard` | 1 · C1 | 折（留合规内核） |
| **合计** | 11 组件 | **31**（P1 16 / P2 15）| 保留 5：Q5 / HI4 / W3 / M4 / AI1 |

## 6 张素材（`public/brand/v3/`，延续 v2 3D 棕熊风）
- **已接线 3 张**：`rp-empty-persona.webp`（RP8 空态卡）· `wealth-life-map.webp`（W1 四区平衡）· `watchlist-why.webp`（M2 自选便签）。
- **未接线 3 张**（审计标「锦上添花」，对应板块以纯删文字即达标）：`market-readonly-deck`（M1）· `history-trend-lens`（HI1）· `autoinvest-dca-vs-lump`（AI3）。文件已产出备用，不接线不影响验收。

## 验收结果汇总（真 DB `brownzone_it11` · 生产服 :8923 · `ALLOW_MEMORY_FALLBACK=false`）
| 项 | 命令 / 脚本 | 结果 |
| --- | --- | --- |
| 生产构建 | `npm run build` | ✓ Compiled 4.1s · 62 页 · 0 error / 0 warn |
| 服务起活 | `next start -p 8923` | `/` → 200（Ready 263ms） |
| 视觉验收 | `scripts/ui-v3-accept.mjs` | 9 页全 **PASS** · 18 图 · 删句 4 句 **0 命中** · v3 图 6 请求 **全 200**（三页命中）· 真视口隐藏揭示 **0** |
| 类型 | `npx tsc --noEmit` | 0 错 |
| Lint | `npm run lint` | 0 错 0 警 |
| 单测 | `npm run test` | **114 文件 / 734 用例 全绿** |
| 定向 E2E | gameflow-regression + internal-test + itest6-quest-nodes | **8/8 passed**（4.3m）；internal-test 2 条 informational medium（1 HTTP_4XX+1 console，degraded 内存态，非门禁） |

产物：`test-results/ui-v3-final-shots/`（18 张桌面1440+移动375）· `scripts/ui-v3-accept.mjs` · 本文件。
