# 第四轮内测（3 轮真实模拟测试）报告与优化清单（2026-07-03）

> 目标：主页视觉升级（PR#15）上线后，对前后端做 ≥3 轮**真实模拟测试**（非视觉化点检），
> 等结果完全返回；对查出问题梳理清单、深度分析后优化升级；无误再交付。

## 一、测试方法（三轮，均真实执行、等全量返回）

| 轮次 | 层面 | 手段 | 结果 |
| --- | --- | --- | --- |
| **R1** | 确定性全套 | `tsc` + `eslint` + `vitest`(95 文件) + `next build`(61 页) + **全量 Playwright E2E**(9 spec, 真浏览器) | tsc 0 / lint 0 / **643 单测** / build ✓ / **E2E 41 passed**（修 1 处 lazy-image 时序 flake） |
| **R2** | 后端 API 真流程 | 自建 `scripts/api-probe.mjs`，对**真 Postgres 生产服务器**(:4200) 发真 HTTP，逐项断言状态码/响应形状/门控/限流/CSRF/错误形状 | **32/32 全绿** |
| **R3** | 多 agent 监工审查 | Workflow 编排 **8 维审查 × 逐条对抗证伪**（27 agents，读真实 R1/R2 输出 + 源码 + 对 :4200 打真活探针） | **16 确认 / 3 证伪** |

关键取真措施：
- R2/R3 打的是 **`npm run start` 生产构建 + 本地 Docker Postgres（已 seed，15 用户/10 run）+ 真实限流（无测试倍率）+ APP_URL 对齐**——覆盖了 E2E（内存兜底）从不触达的**真 DB 写路径 + RLS 姿态 + 生产 CSRF/限流**。
- R3 每条发现都由独立对抗验证员**证伪**（存疑即杀）；证伪掉 3 条（cron secret 属有意设计、两条场景不可达）。

## 二、问题清单（R3 确认 16 条，去重 15 项）

### P1（6）——安全/隐私/合规/数据完整性/严重可读性
| # | 问题 | 位置 | 危害 |
| --- | --- | --- | --- |
| P1-1 | **限流键取客户端可伪造的 X-Forwarded-For 最左段**，轮换 XFF 即可绕过撞库/刷注册/刷改密/刷发信防护（活探针实证：60 次喷洒 0 次 429） | `rate-limit.ts:75` | 安全 |
| P1-2 | **生活账本「执行预算」无回合幂等**，同回合可脚本无限刷现金/净值→喂 power-score 刷战力榜（活探针：每次 +1718 净值） | `life-cashflow.ts:455` | 竞争完整性 |
| P1-3 | **榜单隐私泄露**：个人卡「私有名次」(含隐身玩家) 与榜单「可见名次」(去隐身) 同屏，差值=上方隐身人数→校级小样本去匿名 | `ranking.ts:120` | 未成年人隐私 |
| P1-4 | **萌宠奖励图鉴仍整套回传 common/rare/epic 线级**并渲染稀有度晋级色阶——违反防射幸不变量（任务卡侧已治本、萌宠侧漏网） | `pet-rewards.ts:9` | 未成年人合规 |
| P1-5 | **WRITE_FNS 缺 6 个理财2.0 写函数**，`ALLOW_MEMORY_FALLBACK=true` 时写库失败静默落内存→假成功+丢数据 | `repo.ts:319` | 数据完整性 |
| P1-6 | **战力卡核心分数白字压浅底 1.05:1 近乎不可见**（bz-hero-stat 浅芯片叠深色 hero 的 text-white） | `power-card.tsx:130` | 可读性/a11y |

### P2（4）——数据/隐私/无障碍
| # | 问题 | 位置 |
| --- | --- | --- |
| P2-1 | WRITE_FNS 写错函数名：登记单数 `appendAiMessage`，真正入 withDb 的是复数 `appendAiMessages`→AI 消息同样静默兜底风险 | `repo.ts:326` |
| P2-2 | 榜单 API 向每个客户端透传玩家内部 `userId`（可关联 别名↔身份） | `board/route.ts:40` |
| P2-3 | 首页「查看学习榜」CTA `text-brand`(#f08a38) 压白底对比 ~2.1:1 不达 AA | `power-rank-teaser.tsx:115` |
| P2-4 | 移动端横滑图鉴卡组无可聚焦子元素+容器无 tabindex→键盘用户无法滚动查看 | `collection.tsx:369` |

### P3（5）——教学诚实/一致性/触控
| # | 问题 | 位置 |
| --- | --- | --- |
| P3-1 | 贷款闸门封顶 12 万，但回合复利(×1.018)不再封顶→债务越上限、回撤 >100% 误导 | `simulation.ts:590` |
| P3-2 | 萌宠 review-crown 统计 `wealth_review + advance`，与任务侧（只数 wealth_review）不一致 | `pet-rewards.ts:115` |
| P3-3 | 徽章式按钮触控目标 <40px（战力分享/编辑档案/翻回卡背） | 3 处 |
| P3-4（记录不改） | trade `orderMode:"limit"` 下拉从不收集限价价格，市价/限价成交无差别（误导） | 产品决策，留内容组 |
| P3-5（记录不改） | bank/venture 强制最小金额(500/2000) 静默上调用户输入 | 教学设计，留 UI 提示后续 |

### 对抗证伪（3 条，不予采纳）
- cron/recompute secret 在非生产放行 = 有意设计（CLAUDE.md 明载 production 强制）。
- 理财写路径 `!executor` 分支——触发机制自相矛盾，场景不可达。
- getVentureValue 单边 clamp——数值对称性瑕疵但 12 项轨迹内不可达 NaN。

## 三、深度优化与实施（P1+P2 全修 + P3 三项廉价修，2 项判断题留档）

| 修复 | 方案 | 回归锁 |
| --- | --- | --- |
| P1-1 | 新增 `clientIpFrom()`：优先平台注入的 `x-real-ip`，退化取 XFF **最右**跳（受信代理端），绝不取最左客户端可写段 | `rate-limit.test.ts` ×5（含伪造 XFF 不改键） |
| P1-2 | `applyLifeCashflowChallenge` 加回合级幂等守卫（对齐 auto-invest），同回合二次执行抛中文错误 | `life-cashflow.test.ts` ×1 |
| P1-3 | `viewerPrivateRanks` 只数「可见集 + 自己」，隐身他人不入分母→公开玩家卡名次≡榜名次（零差可泄露） | `ranking.privacy.test.ts` ×2 + 改写 `ranking.test.ts` 旧漏测 |
| P1-4 | 萌宠 `rarity(common/rare/epic)` → `tier(basic/advanced/honor)` 全量改名 + 中性化配色（去 rose 大奖色阶） | R2 探针断言无 rarity 线级 |
| P1-5/P2-1 | WRITE_FNS 补齐 6 理财2.0 写函数 + 修正 `appendAiMessage`→`appendAiMessages` | 既有 repo-fallback 审计守 |
| P1-6 | 战力卡核心分去掉浅芯片 `bz-hero-stat`，白字直接压深渐变（高对比） | — |
| P2-2 | 榜单序列化剥离 `userId`，客户端自我高亮改用服务端 `isViewer`，React key 改 `rank` | R2 探针断言不透传 userId |
| P2-3 | CTA `text-brand`→`bz-brand-text-on-light`(amber-800，AA) | — |
| P2-4 | 横滑容器 `tabIndex=0 + role=group + aria-label` + 焦点环（原生滚动容器聚焦后方向键可滚） | — |
| P3-1 | `TEACHING_DEBT_CAP` 提到模块级，复利后 `Math.min(cap, debt*1.018)` 封顶 | `simulation.test.ts` ×1 |
| P3-2 | review-crown 只数 `wealth_review`，与任务侧对齐 | — |
| P3-3 | 三处徽章按钮加 `min-h-10`（40px） | — |

## 四、复验（无误后交付）

| 层 | 结果 |
| --- | --- |
| `tsc --noEmit` | ✅ 0 |
| `eslint` | ✅ 0（另把 `/.tmp/` 加入 ignore，本地 scratch 不再误触发） |
| `vitest` | ✅ 95 文件 **643 全绿**（634 + 9 新回归锁） |
| `next build` | ✅ 61 页 |
| R2 API 真流程探针（真 Postgres 生产服务器） | ✅ **32/32**（含 3 条 R3 修复复验：pet-rewards 去 rarity / 生活账本二次 400 / 榜单不透传 userId） |
| 全量 Playwright E2E | ✅（见交付说明） |

## 五、附：测试资产
- `scripts/api-probe.mjs` — 后端 API 真流程探针（可对任意 BASE_URL 复跑）
- `.tmp/itest4/` — R1/R2/R3 全部原始输出留档（r1-deterministic.log / r1-e2e-full.log / r2-api-probe.json / r3 workflow 输出）
- R3 workflow 脚本 + 27 agent 逐条证据在会话 workflow 转录目录
