# Brown Zone 多 Agent 内测试运行问题清单（2026-06-29）

## 范围

- 项目：Brown Zone / Mr.Brown 经济沙盘。
- 重点页面：`/demo`、`/student`、`/student/quests`、`/student/market`、`/pricing`、`/admin`。
- 重点能力：任务中心、卡牌/伙伴奖励、青少年学习护栏、AI 导师、订阅转化、课堂试运行、离线/线上部署。
- 本轮方式：主线程验证 + 多角色只读 agent 审阅 + 代码图审查 + 自动化测试。

## 已执行的多 Agent 角色

| 角色 | 审阅重点 | 状态 |
| --- | --- | --- |
| 教育叙事/青少年体验 | 游戏化奖励、概念负荷、学习护栏 | 完成 |
| 视觉与产品设计 | 任务中心风格、市场页密度、IP 一致性 | 完成 |
| 可访问性审查 | 键盘、读屏、对比度、动效可达性 | 完成 |
| 代码评审 | 任务中心状态、翻卡、并发、可维护性 | 完成 |
| 后端/运维 | Supabase、RLS、订阅、微信/离线环境 | 完成 |
| 商业模式 | 试用、订阅、学校授权、家长支付路径 | 完成 |
| 课堂教师视角 | 45 分钟课堂、教师端干预、作业闭环 | 完成 |
| 认知心理 | 14-19 岁认知负荷、排名压力、收集焦虑 | 完成 |
| QA 旅程 | demo -> student -> quests -> market 的冒烟路径 | 完成 |
| 动效性能 | GSAP、无限浮动、reduced-motion、GPU 压力 | 完成 |

> 说明：CodeRabbit CLI 在当前 Windows 环境不可用（`coderabbit` command not found，且 `sh` 缺失），因此 CodeRabbit 审查降级为本地 `code_review_graph` + 手动 diff 审查。

## 已修复问题

| 编号 | 问题 | 修复证据 |
| --- | --- | --- |
| F-01 | `learn-catalog` 的课程筛选值为乱码，可能导致“核心/进阶/运营/家校”筛选不匹配。 | [learn-catalog.tsx](../src/components/site/learn-catalog.tsx) 已改为正常中文 value，并移除乱码 tint key。 |
| F-02 | 任务中心赛季任务/今日任务航线卡初始即暴露内容，翻卡感弱。 | [student-quest-dashboard.tsx](../src/components/student/student-quest-dashboard.tsx) 已改为默认卡背，点击翻到正面。 |
| F-03 | 赛季任务卡翻开后不能回到卡背，探索感不足。 | 赛季任务正面新增“翻回卡背”按钮。 |
| F-04 | 翻卡交互缺少明确测试保护。 | [student-quest-dashboard.test.tsx](../src/components/student/student-quest-dashboard.test.tsx) 新增赛季卡和航线卡翻面测试。 |
| F-05 | 本地 `.cloudflared/` 产物容易误提交。 | [.gitignore](../.gitignore) 已加入 `.cloudflared/`。 |
| F-06 | 主任务锦囊翻到背面后，键盘焦点仍可能停留在隐藏的正面按钮。 | 主任务卡增加正/背面焦点 ref，翻开后聚焦“查看任务详情”，翻回后聚焦“打开任务锦囊”；测试已覆盖。 |
| F-07 | 任务领取与学习卡领取接口缺少试用/订阅操作门禁。 | `/api/student/quests` 与 `/api/student/quests/draw` 均补 `canUserOperate`，过期用户返回 403，测试已覆盖。 |
| F-08 | 学生端仍出现“抽取、典藏、差 N 张、付款链接”等高刺激或支付压力文案。 | 学生可见区域改为“领取学习卡 / 系统 / 已收藏 / 家长确认链接 / 开通说明”。 |

## P0 / P1 问题清单

### P1-01：生产环境支付和订阅配置仍需真实商户配置

- 风险：当前微信支付/人工核验可用于演示或试点，但真实线上收费必须补齐商户号、证书、回调域名、生产 env。
- 影响：正式收费闭环、订阅自动开通、家长支付可信度。
- 建议：上线收费前执行 `npm run env:doctor`，并区分 `.env.offline.example` 与 `.env.production.example`。

### P1-02：排行榜/战力文案仍需持续弱化竞争压力

- 风险：青少年容易把“战力/排名/超越”误读为真实投资能力或同伴比较压力。
- 影响：教育合规、家长接受度、课堂氛围。
- 建议：把“战力/王座/超越前一名”逐步替换为“学习进度/复盘区间/决策节奏”。

### P1-03：任务奖励仍需避免“抽卡/稀有/补抽”语义

- 状态：学生可见主路径已修复一批；底层实现注释和历史文档里仍保留“抽取/集齐”等技术语义，不直接展示给学生。
- 风险：虽然奖励不影响净值和排行榜，但语言和视觉过于接近抽卡，可能触发收集焦虑。
- 影响：未成年人友好、教育产品可信度。
- 建议：后续把 `src/lib/cards.ts` 的技术注释也统一成“领取/收藏/点亮”，并继续审查图鉴、排行榜和宠物奖励的边缘文案。

### P1-06：付费转化必须继续家长/教师确认优先

- 状态：学生端横幅与确认链接 CTA 已改为“开通说明/家长确认链接”，不再在学生界面强调“付款链接”。
- 风险：底层支付 API 与历史文档仍有“付款链接”语义，后续产品化时需要统一到“家长确认/学校授权”。
- 影响：未成年人支付合规、家长信任。
- 建议：价格页和后台继续保留真实支付能力，但学生端只做学习状态说明和家庭/教师确认入口。

### P1-04：教师端课堂闭环不足

- 风险：教师端更像数据看板，不是完整课堂指挥台。
- 影响：学校试点、课堂可执行性、教师复购。
- 建议：补“课前任务 -> 课中干预队列 -> 小组解释 -> 出口卡 -> 班级报告”流程。

### P1-05：端口/Origin 本地验证路径容易踩坑

- 风险：`127.0.0.1` 与 `localhost` 可能触发 Origin 校验差异。
- 影响：教师本机迁移、演示稳定性。
- 建议：本地使用说明固定访问 `http://localhost:<port>`，并在 Origin allowlist 支持教师机常用端口。

## P2 问题清单

- 任务中心角色风格明显强于策略台/市场页，整体 IP 需要统一视觉世界观。
- `/student/market` 信息密度偏高，应加“今日一个小任务”来降低认知负荷。
- GSAP 无限浮动头像在低端移动端可能消耗 GPU/电量，需移动端降级。
- JS `scrollIntoView({ behavior: "smooth" })` 需要统一尊重 `prefers-reduced-motion`。
- AI 导师建议需要更靠近操作点，避免学生只看结果不看理由。
- 普通学生付费入口需要更明确地引导家长/教师确认，避免未成年人直接支付体验。

## 验证证据

```text
npm run test -- src/components/student/student-quest-dashboard.test.tsx --run
PASS: 1 file / 6 tests

npm run lint
PASS

npx tsc --noEmit --pretty false
PASS

npm run build
PASS: Next.js production build, 61 routes generated

npm run test -- --run
PASS: 86 files / 591 tests

python -m code_review_graph update
PASS

python -m code_review_graph detect-changes --brief --base HEAD
PASS: 2 changed files, risk score 0.00
```

## 当前限制

- 当前机器对新端口启动 Next dev 返回 `EACCES`，所以本轮无法稳定完成浏览器截图烟测。
- CodeRabbit CLI 不可用，已降级为代码图和手动审查。
- Jam/DataCamp 本轮没有真实会话/课程数据输入，因此未作为证据源，只保留为后续试运行工具。
