# UI v3 · 学生端登录后文字密度深度审计（2026-07-21）

> 分支 `feat/student-ui-v3`。对**学生端 9 个登录后页面**逐板块审计，量化「防御性教学段落」并给四选一裁决（删 / 折 / 图形化 / 图文卡）。
>
> **与上轮的关系**：ui-v2 Phase 0（`docs/ui-v2/01-phase0-text-density-audit.md`，70 板块）已在 P2/P3 落地大量折/删/图形化，本轮**只审当前源码剩余密度**——凡 v2 已处理项（Disclosure 折叠 season/objective/thermometer/tutor-radar note、今日必看 summary 删、服务九宫格图标化、市场 klineSummary 折、sectorSummary sr-only、quests 合规声明合并为 1 处、wealth allocation hint 折、life weekly 移入折叠等）一律不重列。本轮抓的是 **① v2 flag 了但 P2 漏做的项**（集中在 `risk-profile`）+ **② v2 未覆盖的残余 concept-intro / 自我说明句 / 数字下的方法论 hint**。
>
> **对标口径**：Stripe「当前任务优先、解释收进折叠」· Duolingo「图代替说」· Apple「数字大、标签小」。硬性原则：每屏至多一个教学句；已折叠过的不重复折叠；不删有数据绑定的动态内容。
>
> 判定基准沿用 v2：单板块可见文案 >240 字=过载，120–240=偏多；本轮页面普遍已 <120，故按**单条**（一段防御性文字）粒度审。

## 统计总览

| 指标 | 值 |
| --- | ---: |
| 总候选条数（评估过的板块行） | **36** |
| ├ 保留（评估后判定不动：Q5/HI4/W3/M4/AI1） | 5 |
| └ 可落地（删/折/图形化/图文卡） | **31** |
| P1 条数（高减字 × 低成本，无需新图） | **16** |
| P2 条数（含图文卡/需新图 或 低字数） | **15** |
| 交叉项（platform 外壳，非 student/ 作用域，另记不计入） | 1 |
| 预期可见减字合计 | **≈ 1,190 字**（P1 ≈ -745 / P2 ≈ -445） |
| 新图张数（图文卡，全部 `public/brand/v3/`，≤10 约束） | **6** |
| 复用现有素材的板块（图形化，0 新图） | 5 组 |

密度画像（当前源码，从高到低）：`risk-profile`（9 条 · ~440 字，v2 漏做重灾区）> `quests`（5 条 · ~180 字）> `history`（4 条 · ~113 字）> `wealth`（3 条 · ~115 字）> `life`（3 条 · ~100 字）> `market`（4 条 · ~80 字）> `auto-invest`（3 条 · ~63 字）> `student` 首页（4 条 · ~130 字，多为 allocation-panel 残余）> `credit`（1 条 · ~20 字）。

---

## `/student/risk-profile`（9 条 · ~436 字）— **v2 漏做重灾区，P1 主战场**
文件：`src/components/student/student-risk-profile-dashboard.tsx`（实拍：`student-risk-profile-desktop.png` 逐条可复核）

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| RP1 | 当前配置 vs 人格区间 · `item.hint`（`:790`，3 项各一句）| ~66 | **图形化** | v2 已 flag「hint 三句删除，双色进度条+高于/低于徽章已足够」——**P2 漏做**；删 `item.hint`，保留双进度条+`allocationTone` 徽章 | 66 | **P1** |
| RP2 | 雷达维度解释 · 6×`metric.hint`（`:851-857`）| ~90 | **折** | v2 已 flag 折为「查看维度说明」——**P2 漏做**；6 张卡的 `metric.hint` 收进单条 Disclosure（文本保留在 panel 内，维持 aria-hidden 雷达的等价物） | 90 | **P1** |
| RP3 | Mr.Brown 教练 · `coach.nextSteps`（`:824`，全铺开）| ~60 | **折** | v2 已 flag「默认 1 条其余收起」——**P2 漏做**；`slice(0,1)` + Disclosure 收其余（复用 wealth/credit 现成折叠模式） | 60 | **P1** |
| RP4 | Hero 副标题（`:395-398`，两句）| ~65 | **删** | 「通过真实生活情境测一测…它不是买卖建议，而是一张帮助你"认识自己"的训练地图」两句砍成一句「测一测你的风险承受方式，映射到当前配置」 | 45 | **P1** |
| RP5 | 6 个情境选择 · intro（`:482-484`）| ~35 | **删** | 「每题只测一个概念，降低认知负荷。答案没有对错…」→ 删（右上已有 `0/6 已翻开·已选择` 计数承担进度语义） | 35 | **P1** |
| RP8 | 空态卡 paragraph（`:468-470`）| ~65 | **图文卡** | 「还没有生成投资人格。答完下面 6 题…」→ 一张空态插画卡（`rp-empty-persona.webp`）+ 一句「答完 6 题，解锁你的投资人格」 | 45 | P2 |
| RP6 | 用真实行为复评 · intro（`:624-626`）| ~40 | **折** | 「结合你的回合记录、仓位纪律…生成更贴近真实操作的行为画像」收进「这是什么」Disclosure | 40 | P2 |
| RP7 | 行为复评 idle 提示（`:664-666`）| ~40 | **删** | 「建议完成几次交易…再复评」与上句语义叠加，删（按钮文案已表意） | 40 | P2 |
| RP9 | 当前配置 vs 人格区间 · intro（`:777-778`）| ~30 | **折** | 「建议区间来自你的测评倾向…不代表真实投资建议」含合规意味 → 折为一行灰字免责（不硬删） | 15 | P2 |

---

## `/student/quests`（5 条 · ~180 字）
文件：`src/components/student/student-quest-dashboard.tsx`（合规免责句已在 `:1432` 合并为 1 处 = v2 已做，不重列）

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| Q1 | 指挥官简报 · 两段自我说明（`:173-175` +「任务不会一股脑摊开…」`:224-226`「页面默认只展示关键信息…」）| ~90 | **删** | v2 已 flag「留对话气泡一段即可」——**P2 漏做**；删这两段口播式元说明，保留 `:180-182` 指挥官对话气泡（已有 commander-mission 插画承载视觉） | 90 | **P1** |
| Q2 | 任务地图 · intro（`:361-363`）| ~40 | **删** | 「像闯关地图一样选择今日航线：先观察节点，再翻开任务卡…」→ 删（地图节点+「点击节点切换航线」徽章已表意） | 40 | **P1** |
| Q3 | 本赛季地图 · intro（`:528`）| ~30 | **删** | 「卡通航线图把目标拆成四座小岛，每完成一座就点亮一段路线」→ 删（SVG 路线图已图形化表达） | 30 | **P1** |
| Q4 | 任务中心 Hero 副标题（`:1284-1286`，两句）| ~40 | **删** | 「把观察、交易…拆成可完成的小关卡。每次打开沙盘，都知道下一步练什么」砍成一句 | 20 | P2 |
| Q5 | 连续任务导航 · intro（`:1338-1340`）| ~30 | **保留** | 「Mr.Brown 会把学习动作串成连续任务：先体检，再调整，最后复盘」= 下方 3 步的纲，功能性，保留 | 0 | — |

---

## `/student/history`（4 条 · ~113 字）
文件：`src/components/student/student-history-review-dashboard.tsx`（AI 诊断/下一步已折 = v2 已做；橙色方法论框已删）

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| HI3 | Timeline ChartShell · description（`:575`）| ~50 | **删** | 「每个回合都保留了主题、事件和动作分组。先看摘要，再展开动作，会比从流水里硬找问题更高效」→ 删（下方 `<details>` 自解释） | 50 | **P1** |
| HI1 | Dark Hero 副标题（`:437-439`）| ~45 | **删** | 「把每一回合的净值、风险、纪律和资金结构放在同一条线上看，更容易识别"做对了什么"」→ 砍成一句或删（KPI+图表已承载） | 45 | **P1** |
| HI2 | MetricCard「最大回撤」hint（`:409`）| ~18 | **删** | 「这项越稳，说明你越能把收益留在账户里」= 纯方法论、无数据 → 删（Apple 数字大标签小）。注：`累计回合`/`纪律趋势` 的 hint 内嵌 stageLabel/riskRange 数据，保留 | 18 | **P1** |
| HI4 | 「先看节奏，再拆动作」h3（`:497`）| ~8 | **保留** | 板块标题，短，保留 | 0 | — |

---

## `/student`（首页：home-hub + sandbox + allocation-panel · 4 条 · ~130 字）
多数 v2 已做（season/objective/thermometer/今日必看/九宫格）。残余集中在 `student-allocation-panel.tsx`。

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| H3 | AI 配置中枢 · `suggestions[].detail`（`student-allocation-panel.tsx:363-378`，3 卡全铺开）| ~90 | **折** | 与 wealth 一致：默认铺开与诊断最相关 1 条，其余进 Disclosure | 60 | **P1** |
| H2 | 配置中枢 · `slice.hint` 重复（暗环图例 `:150` + 「当前配置 vs 建议区间」`:329` 各显一次）| ~44 | **删** | 同一 `slice.hint` 同页出现两次；删「当前配置 vs 建议区间」处的副本（暗环处保留），双进度条+高于/低于徽章已够 | 44 | P2 |
| H4 | sandbox「我的当前位置」note（`student-sandbox.tsx:1049`）| ~16 | **删** | 「继续提高纪律分和现金垫，排名会更稳」鼓励语、无数据 → 删 | 16 | P2 |
| H1 | 服务九宫格副标题「12 个训练入口，点击即进」（`student-home-hub.tsx:513`）| ~10 | **删** | 自我说明，删（九宫格自明） | 10 | P2 |

---

## `/student/wealth`（3 条 · ~115 字）
文件：`src/components/student/student-wealth-dashboard.tsx`（allocation hint 已折、coaching/review 已折、zone 已图标化 = v2 已做）

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| W1 | 多元理财地图 · intro（`:395-397`）| ~45 | **图文卡** | 「真实理财不只看一只资产涨跌，而是在安全垫、成长资产、生活目标和负债之间…」= 一个 concept（四区平衡）→ 一张示意图 `wealth-life-map.webp` + 一句「四区平衡，别只看一只涨跌」 | 35 | P2 |
| W2 | 持有总入口 · 4×GatewayCard `summary`（`:382-385`，各 24-30 字）| ~110 | **图形化** | 4 张导航卡加 `service-icons`（**复用** history-scroll/fund-basket/goal-piggy/protection-umbrella，均已存在）+ summary 压成 ≤12 字关键词 | 60 | P2 |
| W3 | 信心刻度 hint（`:599-601`）| ~20 | **保留** | 「高信心也要写下风险假设…」贴着输入控件的即时引导，功能性，保留 | 0 | — |

---

## `/student/market`（4 条 · ~80 字）
文件：`src/components/student/student-market-board.tsx`（reason/coachNote/content summary 已 ExpandableText 折、radarSummary 已缩一句、sectorSummary 已 sr-only = v2 已做）

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| M3 | 6 维教学观察雷达 · caption「文字说明移到右侧，避免图内拥挤」（`:1313`）| ~16 | **删** | 口播式布局自述、对学生零价值 → 直接删 | 16 | **P1** |
| M1 | 市场信息 · intro（`:671-673`）| ~30 | **删** | 「这里是只读观察台，先看主线，再看结构，最后再去问 AI」纯操作说明 → 删或压成 chip「只读观察台」 | 30 | **P1** |
| M2 | 我的自选观察 · intro（`:897-899`）| ~35 | **图文卡** | 「先把"为什么值得看"写下来…」→ 复用/新图小卡 `watchlist-why.webp`（棕熊贴便签）+ 一句「先写为什么，再看验证」 | 20 | P2 |
| M4 | 日 K 线「沿用 A 股红涨绿跌配色，与美股相反」（`:1184-1186`，条件显示）| ~16 | **保留** | 配色约定属教学功能点（跨市场易错），保留但可缩为一行 | 0 | — |

---

## `/student/life`（3 条 · ~100 字）
文件：`src/components/student/student-life-cashflow-dashboard.tsx`（weekly 已移入折叠、plan/insurance concept 选中态才显、stress teachingPoint 已折、KPI hint 已删 = v2 已做）

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| L3 | 下一步行动 · `coach.nextSteps`（`:526`，全铺开）| ~75 | **折** | 与其它页一致：默认 1 条 + Disclosure 收其余 | 50 | **P1** |
| L1 | 选择预算策略 · intro（`:307-309`）| ~35 | **删** | 「预算不是少花钱比赛，而是给重要目标留位置。切换方案后会重新测算现金流」→ 删（切换即重算是行为反馈，非需前置说明） | 20 | P2 |
| L2 | 本月预算分配 · 4×`row.hint`（`:379`）| ~60 | **折** | 4 行 hint 收进单条 Disclosure（label+比例+进度条+金额已足够扫读） | 30 | P2 |

---

## `/student/auto-invest`（3 条 · ~63 字）
文件：`src/components/student/student-auto-invest-dashboard.tsx`（标的简介/coach/schedule note 已折 = v2 已做）

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| AI3 | 定投 vs 一次性 · dark note 方法尾（`:647-653`）| ~30 | **删** | 保留「本次差异：¥X」数字句，删尾巴「差异不是结论，而是复盘入口：市场路径不同…」 | 30 | P2 |
| AI2 | 执行轨迹 · intro（`:502-504`）| ~28 | **删** | 「机器人按回合拆单，重点是看清成本与现金余量如何联动」→ 删（下方 3 数字卡+轨迹图自明） | 18 | P2 |
| AI1 | 机器人参数 · intro（`:307-309`）| ~25 | **保留** | 「参数越激进，现金越容易被占用。先看安全垫，再看收益率」贴着参数表的操作引导，短，保留 | 0 | — |

---

## `/student/credit`（1 条 · ~35 字）
文件：`src/components/student/student-credit-lab-dashboard.tsx`（Hero 已压一句、coach 已折 = v2 已做）

| # | 板块（文件行号段） | 现文字字数 | 裁决 | 落地写法（一句话） | 预期减字 | 优先级 |
| --- | --- | ---: | --- | --- | ---: | --- |
| C1 | 信用场景卡 · intro（`:210-212`）| ~35 | **折** | 「先模拟，再执行。执行借款或还款会写入沙盘历史，但不会凭空提高净值」→ 保留合规内核「不会凭空提高净值」压成一行，其余折 | 20 | P2 |

---

## 交叉项（platform 外壳，非 `src/components/student/` 作用域，供派工另立）
`src/components/platform/*`：左侧栏 h1「学生策略台」下副标题「围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。」(~45 字) — **每一页侧栏都渲染**，属产品自述，建议删或缩为一句。因超出本次学生组件作用域，单列不计入 36/减字合计，交由 ui_implementer 平台外壳批次处理。

---

## 素材计划表（图文卡 / 图形化）

### A. 复用现有素材（0 新图，图形化落地）
| 板块 | 复用资产 | 说明 |
| --- | --- | --- |
| W2 持有总入口 4 卡 | `public/brand/service-icons/{history-scroll,fund-basket,goal-piggy,protection-umbrella}.webp` | 全部已存在，直接接上图标即可 |
| RP1 风险配置三区 | lucide `ShieldCheck`/`Rocket`/`Home`（与 wealth zone 同法） | 无需位图 |
| Q1 指挥官简报 | `public/brand/quest-world/commander-mission.webp` | 已在页面，删文字后由图承载 |
| RP3/L3/H3 建议折叠 | 现成 `Disclosure` 组件 | 纯逻辑 |
| history 学习信号空态 | `public/brand/quest-world/characters/penguin-history-archivist.webp` | 如需插画可复用，非必须 |

### B. 新图（`public/brand/v3/`，6 张，3D 萌宠棕熊 × 写实渲染混合，延续 `public/brand/v2` 风格）
风格锚：v2 一致的暖橙/深墨底、柔和棚拍光、圆润 3D 棕熊主角、`webp` ~40KB（PNG→WebP sharp 压缩）。

| # | 文件名 | 尺寸 | gpt-image-2 提示词 | 替代文字(alt) | 服务板块 |
| --- | --- | --- | --- | --- | --- |
| 1 | `rp-empty-persona.webp` | 800×600 | "3D rendered friendly brown bear mascot in warm amber studio light, peeking curiously at a face-down glowing tarot-style scenario card and a small brass compass on a soft desk, cozy realistic-toy hybrid style, deep navy-to-amber gradient background, soft rim light, empty-state illustration, no text" | 投资人格待生成：答完 6 题即可解锁 | RP8 风险测评空态 |
| 2 | `wealth-life-map.webp` | 900×500 | "3D brown bear mascot standing on a small balance beam juggling four glowing floating islands labeled by icon only (piggy-bank, rocket, house, warning-coin), warm amber and teal palette, realistic soft-toy render, dark ink background with subtle grid, no readable text" | 多元理财：安全垫·成长·生活·负债四区平衡 | W1 多元理财地图 |
| 3 | `market-readonly-deck.webp` | 640×640 | "3D brown bear mascot with paws politely behind its back, watching a wall of glowing stock ticker cards, 'look but do not touch' read-only mood, warm studio light, amber-navy gradient, realistic toy render, square composition, no text" | 只读观察台：先看主线再看结构 | M1 市场信息（小卡/chip） |
| 4 | `watchlist-why.webp` | 640×640 | "3D brown bear mascot writing a short sticky note beside a small candlestick chart, thoughtful pose with a pencil, warm amber light, soft realistic-toy render, navy background, square, no readable text on the note" | 自选观察：先写为什么，再看是否验证 | M2 我的自选观察 |
| 5 | `history-trend-lens.webp` | 900×500 | "3D brown bear mascot holding a magnifying glass over a glowing rising-then-dipping net-worth line on a dark chart, calm analytical mood, warm amber highlight on the line, realistic soft-toy render, wide composition, no text" | 历史复盘：把每回合放同一条线上看节奏 | HI1 历史复盘 Hero（可选，非必须） |
| 6 | `autoinvest-dca-vs-lump.webp` | 900×500 | "3D brown bear mascot beside two side-by-side glowing stacks of coins — one built gradually in small steps, one dropped in a single pile — neutral comparison mood, warm amber and slate palette, realistic toy render, no text" | 定投 vs 一次性：路径不同，答案也不同 | AI3 定投对比 |

> 6 张均在 ≤10 约束内；#5/#6 为「锦上添花」型（对应板块也可纯删文字达标），若需进一步压缩可只做 #1-#4。

---

## 落地批次建议（按 减字收益 × 实现成本）
- **P1 批（16 条，纯 删/折/图形化，无新图，约 -745 可见字）**：RP1 RP2 RP3 RP4 RP5 · Q1 Q2 Q3 · HI1 HI2 HI3 · M1 M3 · H3 · L3 · C1（注：C1 含合规内核，按「折」保留一行）。一次 PR 即可落，零素材依赖，先行。
- **P2 批（15 条，含 6 张图文卡新图 + 低字数删折，约 -445 可见字）**：RP6 RP7 RP8 RP9 · Q4 · W1 W2 · H1 H2 H4 · M2 · L1 L2 · AI2 AI3 · 交叉项侧栏。其中 W1/M2/AI3/RP8 依赖 `public/brand/v3/` 图产出后落地，其余为纯删折可与 P1 合批。（保留不动：Q5/HI4/W3/M4/AI1）

## 验收锚点
- 实拍 18 张：`test-results/ui-v3-audit-shots/`（9 页 × 桌面1440 全页 + 移动375 全页）。
- 源码行号以分支 `feat/student-ui-v3` 当前 HEAD 为准；每条可对照实拍复核（risk-profile / history 桌面全页已逐条肉眼验证）。
