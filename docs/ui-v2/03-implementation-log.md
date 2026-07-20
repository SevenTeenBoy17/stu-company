# UI v2 实施总览（feat/ui-motion-upgrade · 2026-07-20）

> 用户驱动的全站 UI/动效升级：参考 landing.love（动效）与 land-book（版式），
> 主题「少即是多」——折叠/导航消化文字过载，gpt-image-2 素材置换文字，
> landing.love 级动效 primitives。四项决策（用户确认）：全站分阶段 / 重点大改+渐进 /
> 3D 萌宠+写实混搭 / 独立分支不动 PR #18。

## 阶段与提交

| Phase | Commit | 内容 |
| --- | --- | --- |
| P0 地基 | `bfef59a` | ①motion primitives 外科式扩展：`data-motion-split`（SplitText 分行/逐字，aria 自动）、`data-motion-magnetic`（磁性 CTA）、`data-motion-story`（pin 三幕，≥1024px 才 pin），全带 reduced-motion 降级；②信息收敛四件套 `shared/`：Disclosure / SectionNav / TabbedPanel / StatCard（各带单测+axe）；③**5 agent 全站文字密度审计**：22 页 70 板块（折34/删21/图形化9/移1/保留5）→ `01-phase0-text-density-audit.md`；④素材清单 → `02-phase1-asset-plan.md` |
| P1 公开站 | `ea9eb3f` | 首页 hero 写实渲染主视觉+split 标题+磁性 CTA；学练成长**三幕 pin 叙事**；产品矩阵菜单 600 字删成纯 label；模块墙/learn 卡 tagline+折叠；pricing 定位句+前4条+FAQ 手风琴；demo 角色头像；**21 张 gpt-image-2 素材**入库 `public/brand/v2/`（hero 110KB 其余 10-47KB） |
| P2 学生端 | `06421b9` | 9 agent 按互斥文件所有权改 12 组件（约 **-2200 可见字**）：AI 长评「首句常显+折整段」、hint 选中后显示、免责句群 9 变体收敛 1 处、卡背重复删、KPI 图形化。配套修 Disclosure `role="region"`（axe landmark-unique）与 E2E 高度差断言锚旧版式问题 |
| P3 收尾 | 本 commit | life 5 条 / credit 2 条 / auto-invest+wealth 余 4 条（2 条核验 P2 已含）/ admin 2 条 / demo 1 条（约 **-800 可见字**）；polish：行情带铺 texture-market-dark 质感底纹（13KB） |

## 审计消化率

70 板块处置：**~66 条已落地**（教师端 0 标记——功能密度获保留判定；/parent 1 条保留判定；
pricing「学生/家长开通引导」等 5 条保留判定为合规/功能文案）。全站默认视图约
**-5100 可见字**，折叠内容零信息丢失（键盘可达、读屏语义保留）。

## 复验基线（每 Phase 收口都全绿）

`tsc 0 / lint 0 / vitest 725（113 文件，+12 四件套用例）/ build 0 / Playwright E2E 43+ 过`
+ Playwright 实拍 17 张（桌面/移动/减动效 × 公开站/学生端/后台）于
`docs/internal-playtest-screenshots/ui-v2/`（本地不入库）。

## 工程要点（复用价值）

- **并行收敛的三重护栏**：互斥文件所有权 / 不动 lib payload（单测锚定）/ 删字符串前
  grep 测试断言（被断言的折叠保留而非删）。13 agent 两轮扇出零冲突零越权。
- **Disclosure 面板不要 `role="region"`**：同页多折叠触发 axe landmark-unique；
  标准 WAI-ARIA disclosure 面板本不需 landmark。
- **E2E 断言不锚死版式**：布局收敛后按新稳定值（隔离双跑同值）更新阈值，保留意图余量。
- **素材管线容灾**：`api.llm-token.cn` 会 TCP 通但 HTTP 挂死——`gen-ui-v2-assets.mjs`
  已固化双网关故障转移（gpt-agent.cc 优先）+ `AbortSignal.timeout(210s)`，存在即跳过可断点续跑。
- **本地 E2E 与预览互斥**：Next 16 拒绝同项目第二个 dev 实例，跑 E2E 前先停预览服务器。
- **浏览器面板截图会被 GSAP 无限环境动画卡死**：用 Playwright 脚本截图（顺带真验
  reduced-motion）；脚本须放仓库内（node_modules 解析）。
