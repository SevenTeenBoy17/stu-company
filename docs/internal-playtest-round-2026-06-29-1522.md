# Brown Zone 内部多角色内测增量纪要（2026-06-29 15:22 PDT）

## 本轮目标

继续推进“教育游戏大厂内部讨论会 + 内测运维试运行”的长期目标。本轮不做大范围重构，重点验证最近的任务中心翻卡、任务写入门禁、订阅/家长确认边界，以及本地关键路由可访问性。

## 参与角色矩阵

| 角色 | 视角 | 本轮结论 |
| --- | --- | --- |
| 教育游戏产品负责人 | 任务中心是否从静态说明变成可探索的游戏路径 | APPROVE：任务盲盒卡已具备背面到正面的翻卡体验，适合“先探索、再理解目标”的学习节奏。 |
| 青少年认知负荷审查员 | 是否一次暴露过多任务细节 | APPROVE：卡背先展示角色、进度和动作暗示，正面再展示目标与奖励，降低首屏文字密度。 |
| 前端交互工程师 | 翻卡动画、焦点、状态是否真实可用 | APPROVE：主任务卡使用 GSAP rotateY，配合 `aria-expanded`、`aria-pressed`、`inert` 和焦点回收。 |
| 可访问性审查员 | 键盘和读屏用户是否会进入隐藏卡面 | APPROVE：测试覆盖 hidden face inert、翻面后焦点进入可见操作、翻回后焦点回到翻卡按钮。 |
| 订阅/商业边界审查员 | 任务领取和抽卡是否绕过试用/订阅门禁 | APPROVE：`/api/student/quests` 与 `/api/student/quests/draw` 的 focused tests 覆盖门禁。 |
| 后端 API 审查员 | 任务中心写入路径是否有回归风险 | APPROVE：任务领取、抽卡、重复提交保护测试通过。 |
| 运维试运行审查员 | 本地关键页面是否可访问 | APPROVE WITH NOTE：`/`、`/demo`、`/pricing`、`/student/quests` 在 `http://127.0.0.1:4173` 返回 200；当前 `3001` 未响应，后续统一本地使用说明应继续推荐可用端口。 |
| QA 冒烟测试员 | 是否存在立即阻断用户进入任务中心的问题 | APPROVE：focused unit/API tests 通过；仍建议下一轮补 Playwright 视觉截图和真实点击录屏。 |

## 自动化证据

```text
npm test -- src/components/student/student-quest-dashboard.test.tsx src/app/api/student/quests/route.test.ts src/app/api/student/quests/draw/route.test.ts src/app/api/billing/prepay/route.test.ts
PASS: 4 files / 18 tests

python -m code_review_graph update
PASS: graph refreshed

python -m code_review_graph detect-changes --brief --base HEAD
PASS: 42 changed files analyzed, risk score 0.00
```

## 本地路由证据

```text
http://127.0.0.1:4173/               -> 200
http://127.0.0.1:4173/demo           -> 200
http://127.0.0.1:4173/pricing        -> 200
http://127.0.0.1:4173/student/quests -> 200
```

## 已验证的能力

- 任务中心主任务卡支持“卡背 -> 卡面”的 3D 翻转，而不是静态说明块。
- 赛季目标卡、任务航线卡、主任务卡都有正反面状态测试。
- 翻卡后隐藏面不会被 Tab 命中，可见面核心操作会自动获得焦点。
- 已完成任务可以领取学习卡，重复提交有保护。
- 过期/受限学生不能绕过任务 API 继续写入奖励状态。
- 学生普通账号不能直接绕过家长/教师确认创建付费订单。

## 仍需继续的内测问题

| 优先级 | 问题 | 证据状态 | 建议下一步 |
| --- | --- | --- | --- |
| P1 | 真实浏览器截图/录屏证据仍不足 | 当前只有 HTTP 200 与自动化测试，缺少截图比对 | 下一轮用可用浏览器/Playwright 截图 `/student/quests`、移动端宽度、翻卡前后状态。 |
| P1 | 本地端口说明仍容易混乱 | `3001` 未响应，`4173` 可用 | 更新本地启动说明，把端口冲突排查和推荐访问地址写清楚。 |
| P2 | 市场页、策略台和任务中心的动物 IP 风格仍需统一 | 本轮只验证任务中心 | 下一轮抽样检查 `/student`、`/student/market` 是否需要同一角色系统入口。 |
| P2 | reduced-motion 全链路还需要更系统验证 | 任务中心已有 fallback CSS，但不是全站覆盖证明 | 增加 Playwright emulate reduced-motion 的任务中心/市场页 smoke。 |
| P2 | 多 agent 真实工具调用能力受限 | 当前回合没有暴露可用 multi-agent MCP 调用，只能以角色矩阵审查模拟 | 后续若 multi-agent 工具恢复，按“执行 agent != 审核 agent”重新跑并更新本纪要。 |

## 下一轮建议

1. 用 Playwright 截图验证 `/student/quests` 的卡背、卡面、领取弹窗、移动端布局。
2. 继续检查“黑底白字”和按钮可读性问题，重点扫 `/student`、`/student/quests`、`/student/market`。
3. 更新本地启动文档，解释 `3001` 端口不可用时如何切换到 `4173`。
4. 如果浏览器工具恢复，补一轮用户路径录制：登录/游客体验 -> 任务中心 -> 翻卡 -> 查看详情 -> 领取学习卡。
