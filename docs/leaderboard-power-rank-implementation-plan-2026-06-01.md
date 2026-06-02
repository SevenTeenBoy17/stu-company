# 财商战力排行榜 · 实施计划（架构/契约/里程碑级，待最终确认）

> **For agentic workers:** 这是 spec 级实施计划。每个子系统在其阶段 kickoff 时再用 `superpowers:subagent-driven-development` 展开为 bite-sized TDD 任务清单。
>
> **Goal:** 在现有周赛季净值榜之上，构建"财商战力 × 地域段位"多维排行榜（校/市/省/全国 × 周/月/学期赛季），面向 12–18 岁、约 1 万规模。
> **Architecture:** 复用 `season.ts` 同种子=同市场的公平基线；新增 自填地区/学校（必填）、纯函数战力引擎、物化快照 + 窗口函数排名、段位、隐私安全展示。
> **Tech Stack:** Next.js 16 / React 19 / Drizzle + Postgres / Tailwind v4 / framer-motion / Vitest + Playwright。
> **状态:** 待你确认 + 补 1 项输入（校历日期，仅 V2 需要）后开工。

---

## 0. 已锁定决策（来自你的 review）

| # | 决策 | 对实施的影响 |
| --- | --- | --- |
| 1 | 用**合成战力分**，且界面**必须告知**分数组成与权重 | 新增 `PowerCompositionPanel` 透明面板（必做，非可选） |
| 2 | **不绑班级**；学生**必填**所在学校 + 地区 | 去掉"班级可信"分层；改为"必填 onboarding 闸门 + 自填治理（去重/审核/抗刷）" |
| 3 | 接受隐私设计 | 公开榜=昵称+段位+战力+名次(+可选学校)，隐藏真名；opt-in 可见性 + 监护人同意 |
| 4 | 赛季按**校历**，要准确 | `seasons` 表由管理员配置真实学期起止；**需你补具体日期**（V2 才用） |
| 5 | 规模 **~1 万** | 1 万级用"物化快照 + 索引 + 窗口函数"足够；缓存/预计算作为增长预留 |
| 6 | 排行榜**免费** + 赛季奖励**纯荣誉无付费** | 不与订阅门控；奖励=头衔/边框/皮肤等荣誉 |
| 7 | 未成年人**不掉段/软掉段保底** | 段位在赛季内只升不降；跨赛季软重置（高段继承部分） |

---

## 1. 模块/文件结构（决定任务分解）

```
src/lib/leaderboard/
  power-score.ts        # 纯函数：computePowerScore(runMetrics) -> {power, components}
  power-score.test.ts
  tiers.ts              # 段位映射 + 软保底 tierFromPower(), applySoftFloor()
  tiers.test.ts
  regions.ts            # 行政区划静态数据集访问 + 校验 (省/市)
  regions.data.ts       # 国标 GB/T 2260 省市数据（静态导入）
  school-normalize.ts   # 学校名归一化/去重 key
  leaderboard-query.ts  # 排名查询（窗口函数封装）+ 可见性过滤
src/lib/db/schema.ts    # +profiles 列, +schools, +leaderboard_snapshots, +seasons
drizzle/0010_*.sql ...  # 迁移
src/app/api/leaderboard/route.ts             # GET 榜单
src/app/api/profile/region/route.ts          # POST 设置地区+学校（必填）
src/app/api/schools/search/route.ts          # GET 自动补全
src/app/api/schools/route.ts                 # POST 提交待审学校
src/components/student/power-card.tsx         # 战力卡（值+段位+雷达+四名次+分享）
src/components/student/power-composition.tsx  # 透明面板（决策1必做）
src/components/student/leaderboard-board.tsx  # 地域tab×周期tab 榜单
src/components/student/region-school-form.tsx # 必填 onboarding 表单（闸门）
src/components/student/tier-progress.tsx      # 段位进度+升段动画
```

> 每个文件单一职责，可独立测试；遵循现有"repo.ts 单一持久化桥 + 内存兜底"约定。

---

## 2. 数据模型（Drizzle / Postgres）

**`profiles`（既有表）新增列**
```
rank_alias            text          -- 榜单昵称（审核；默认生成 handle，不暴露真名）
province_code         varchar(6)    -- GB/T 2260，必填
city_code             varchar(6)    -- 必填
school_id             uuid -> schools.id   -- 必填
rank_visibility       text default 'public'  -- public | school_only | hidden
rank_consent_at       timestamptz   -- 监护人同意时间（null=未同意，不上榜）
```

**`schools`（新表）**
```
id uuid pk | name text | normalized_name text  -- 去重 key
province_code varchar(6) | city_code varchar(6)
status text default 'pending'   -- pending | approved | rejected
submitted_by uuid | created_at timestamptz
唯一索引: (normalized_name, city_code)  -- 防"成都七中/成都市第七中学"重复
```

**`leaderboard_snapshots`（新表，物化）**
```
id | user_id | period_type text  -- week | month | season
period_key text                  -- 如 W2026-22 / M2026-06 / S-spring-2026
power int                        -- 0..2000
tier smallint                    -- 1..6
components jsonb                  -- 5 维分项（供透明面板/雷达）
school_id | city_code | province_code   -- 反范式，便于分区排名
computed_at timestamptz
唯一索引: (user_id, period_type, period_key)
索引: (period_type, period_key, city_code, power desc) / (..., province_code, power desc) / (..., school_id, power desc)
```

**`seasons`（新表，V2）**
```
id | name | type text(spring|fall) | starts_at | ends_at | status | created_at
```

**行政区划**：`regions.data.ts` 静态导入（省/市，约 34/333 项；区县按数据最小化原则不强制）。

---

## 3. 战力引擎（决策 1，纯函数 + 透明）

```ts
// power-score.ts — 纯函数，可单测；权重为常量便于灰度调参
export const POWER_WEIGHTS = { riskAdjReturn: .30, discipline: .25, drawdown: .20, learning: .15, growth: .10 };

export type PowerComponents = { riskAdjReturn:number; discipline:number; drawdown:number; learning:number; growth:number }; // 各 0..1
export function computePowerScore(m: RunMetrics): { power:number; tier:number; components:PowerComponents } {
  const c = {
    riskAdjReturn: norm((m.netWorth/m.startCapital - 1) / Math.max(m.volatility, EPS), RAR_CURVE),
    discipline:    clamp01(m.disciplineScore / 100),
    drawdown:      1 - clamp01(m.maxDrawdownPct / DRAWDOWN_CAP),
    learning:      clamp01(m.completedLearning / m.totalLearning),
    growth:        clamp01((m.netWorth/m.startCapital - 1) / GROWTH_CAP),
  };
  const raw = Σ(POWER_WEIGHTS[k] * c[k]);
  const power = Math.round(clamp01(raw) * 2000);
  return { power, tier: tierFromPower(power), components: c };
}
```
- 数据来源已有：`netWorth / disciplineScore / maxDrawdown / 动作日志`。`volatility` 用回合收益标准差或现有 riskScore 映射。
- 归一化曲线 `RAR_CURVE / DRAWDOWN_CAP / GROWTH_CAP` 为可调常量 → **建议上线先灰度看分布再定**。
- **透明面板** `power-composition.tsx`：展示 5 维名称、权重、该生分项值（复用 6 维雷达）、一句话解释——满足决策 1"告知组成与权重"。

**段位（`tiers.ts`，决策 7 软保底）**
```
阈值: [0,400,800,1200,1600,1900] → 1..6（理财新手/稳健学徒/精明投资者/策略大师/财商宗师/巅峰）
applySoftFloor(prevTierThisSeason, newTier) = max(prevTierThisSeason, newTier)  // 赛季内不掉段
跨赛季: 软重置——继承 floor(prevTier-1) 或保 1 段
```

---

## 4. 排名服务与接口契约

**排名 SQL（窗口函数，1 万级直接可跑）**
```sql
SELECT user_id, power, tier, school_id, city_code,
  RANK() OVER (ORDER BY power DESC) AS rank
FROM leaderboard_snapshots
WHERE period_type=$1 AND period_key=$2
  AND ( $scope='nation'
     OR ($scope='province' AND province_code=$pc)
     OR ($scope='city'     AND city_code=$cc)
     OR ($scope='school'   AND school_id=$sid) )
  AND rank_visibility IN ('public', /* school_only 仅 school 作用域 */ ...)
ORDER BY power DESC LIMIT $limit OFFSET $off;
```

**`GET /api/leaderboard?scope=school|city|province|nation&period=week|month|season&page=N`**
```jsonc
{ "scope":"city","period":"week","periodKey":"W2026-22",
  "viewer":{ "power":1460,"tier":4,"tierName":"策略大师",
             "ranks":{"school":1,"city":12,"province":340,"nation":5231},
             "components":{...} },
  "entries":[{ "rank":1,"alias":"稳健的小布朗","tier":5,"power":1712,
               "schoolName":"成都市第七中学","cityName":"成都市","isViewer":false }, ...],
  "total":842, "page":1 }
```
**`POST /api/profile/region`** body `{provinceCode, cityCode, schoolId | newSchoolName}` → 校验行政区划 + 学校；**必填**，未填则 `GET /api/leaderboard` 返回 `needsProfile:true`（前端引导 onboarding）。
**`GET /api/schools/search?q=&city=`** → `{schools:[{id,name,status}]}`（自动补全 + 去重）。
**`POST /api/schools`** → 新学校入 `pending`。
错误一律用现有 `{error, message}` 规范。

---

## 5. 隐私 / 合规 / 治理（决策 2、3）

- **必填闸门**：地区+学校未填或未同意 → 不计入榜、引导补全（`region-school-form.tsx`）。
- **公开仅**：`rank_alias` + 段位 + 战力 + 名次（+可选学校名）；**绝不**公开真名/班级/详细地址。
- **同意**：首次上榜走监护人告知同意（家长端）→ 写 `rank_consent_at`；`rank_visibility` 三档 opt-in。
- **自填治理（因决策 2 无班级可信兜底，治理加重）**：学校自动补全+去重(normalized_name)+待审；昵称敏感词审核。
- **抗刷**：战力分本身抗刷（奖励稳健非单局净值）；新号需完赛 N 回合才计入；同校异常增长/同 IP 多号检测 + 现有 rate-limit。

---

## 6. UI / UX（王者风 × 现有设计系统）

- `power-card.tsx`：战力值 + 段位徽章 + 6 维雷达 + 四名次 + 分享（复用 `buildPersonaShareText` 模式）。
- `power-composition.tsx`：分数组成 + 权重 + 分项值（决策 1）。
- `leaderboard-board.tsx`：地域 tab（校/市/省/全国）× 周期 tab（周/月/赛季）；前三名特殊视觉；高亮"你"；分页。
- `tier-progress.tsx`：段位进度条 + 升段 framer-motion 动画；赛季结算页（V2）。
- 严格用 ink/amber tokens、红涨绿跌、`panel`、≥12px 字号。

---

## 7. 分期里程碑 + 工作量（粗估，研发日）

| 阶段 | 范围 | 工作量 | 依赖 |
| --- | --- | --- | --- |
| **V1 · MVP** | 迁移0010(profiles列+schools+snapshots) · 行政区划数据 · 必填 onboarding · 战力引擎+段位(单测) · 周榜(校/市/省/全国) · 战力卡+透明面板 · 隐私展示 | ~6–9 天 | **基线健康**(见 §9) |
| **V2** | 月榜 · 学期赛季榜 · `seasons`表+校历 · 段位继承 · 赛季结算+奖励 · 战力卡分享 · cron 周期刷新 | ~5–7 天 | V1 + **你补校历日期** |
| **V3** | 反作弊强化 · 学校审核后台 · 校内/班级对抗 · 可见性/同意完整流 | ~5–8 天 | V2 |

---

## 8. 测试方案

- **单元(Vitest)**：`computePowerScore`（边界/权重/归一化）、`tierFromPower`+软保底、`regions` 校验、`school-normalize` 去重 key。
- **集成**：排名 SQL（分区/RANK 正确性、可见性过滤）、4 个 API 契约（含 needsProfile / 必填校验 / 越权）。
- **E2E(Playwright)**：未填地区被闸门拦截→补全→上榜；榜单四作用域×三周期渲染；公开榜不出现真名（隐私断言）；段位/战力卡显示。
- **数据**：行政区划数据集完整性；schools 去重唯一索引。
- 复用刚建的 `ui-audit` 思路对新榜单页做排版/可访问性回归。

---

## 9. 前置依赖与排期顺序（重要）

> 本功能含 DB 迁移（0010+）。当前仓库基线有未决问题，**必须先理顺再叠加**：
1. **基线可构建**：先合 PR #3（WIP→main，修复 main 缺 `isWechatMockAllowed`），让 `main` 能独立 build。
2. **目标库迁移到位**：把缺的迁移(0004–0009)应用到你要用的开发库（本功能新迁移 0010 接在其后）。
3. 然后再开 V1 分支开发本功能。
> （本地预览当前是内存模式绕开了漂移库；真要用真库 + 排行榜，需 1、2 先做。）

---

## 10. 仍需你补的 1 项输入

- **校历具体日期**（决策 4）：春季赛季 起止、秋季赛季 起止（以哪所/哪版校历为准？全国产品需 1 套**产品级**赛季历，建议对齐标准学期，管理员可改）。**V1 用周榜不阻塞；V2 赛季榜前给我即可。**

---

## 自检（spec 覆盖）
- 决策1→§3 透明面板✓ 决策2→§5 必填+治理✓ 决策3→§5 隐私✓ 决策4→§2/§10 seasons✓ 决策5→§2/§4 物化+窗口✓ 决策6→§7 免费✓ 决策7→§3 软保底✓。
- 地级市/省/全国→§4 scope✓ 周/月/赛季→§2 period_type✓ 自填学校→§4/§5✓。
