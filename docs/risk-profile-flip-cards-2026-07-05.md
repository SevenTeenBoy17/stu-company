# 风险测评 6 张情境翻卡开发与验收记录

## 目标

把学生端风险测评里的 `6 个情境选择` 从静态题目列表升级为游戏化翻卡体验：默认先展示统一卡背，学生点击后翻到正面，再阅读场景并选择答案。答案继续进入现有风险画像生成与学习数据收集链路。

## 实现范围

- 页面组件：`src/components/student/student-risk-profile-dashboard.tsx`
- 组件测试：`src/components/student/student-risk-profile-dashboard.test.tsx`
- 数据接口：`src/app/api/student/risk-profile/route.ts`
- 领域计算：`src/lib/risk-profile.ts`
- QA 报告：`design-qa.md`
- 截图证据：`.tmp/risk-profile-flipcards/`

## 交互设计

1. 学生进入风险测评页后，`6 个情境选择` 面板默认显示 6 张统一风格的卡背。
2. 每张卡背显示 `Scenario 01-06`、未翻开状态、Mr.Brown 风格插图和“翻开卡片”动作提示。
3. 点击卡背后，卡片执行 3D 翻转，正面显示对应情境题、场景说明和 3 个选择。
4. 学生选择答案后，该卡展示已选择状态，整体计数更新。
5. 完成选择后，点击“生成我的投资人格”，继续调用原有 `POST /api/student/risk-profile` 保存答案并返回画像。

## 数据收集链路

- 客户端使用 `answers: RiskProfileAnswer[]` 保存 `{ questionId, optionId }`。
- `upsertAnswer` 保证每题只有一个最新答案，重复点击会替换而不是追加重复记录。
- 提交时请求体为 `{ answers }`。
- 服务端使用 zod 校验 `answers` 数组长度和字段，再通过 `sanitizeAnswers` 验证题目与选项是否存在。
- `buildRiskProfilePayload` 会把答案归一化，生成风险分、雷达维度、建议区间和教练建议。
- `upsertRiskProfile` 将 `selectedAnswers`、分数、band 和生成时间落库。

## 可访问性与响应式

- 卡背是可聚焦的 `button`，支持键盘触发。
- 翻开后卡背设置 `pointer-events-none`、`tabIndex={-1}`、`aria-hidden`，避免遮挡或重复焦点。
- 正面未揭示时选项按钮禁用，揭示后恢复焦点与点击。
- 卡面使用统一最小高度和内部滚动，长题目或长选项不会撑破整体网格。
- 浏览器脚本检查桌面视口无横向溢出。

## 验收证据

### 浏览器端到端

运行方式：使用 Playwright Chrome 通道访问 `http://127.0.0.1:4327/student/risk-profile`。

结果摘要：

- 登录状态：`POST /api/auth/login` 返回 200。
- 卡片数量：6 个 `risk-scenario-flip-card-*`，6 个 `risk-scenario-card-back-*`。
- 翻开计数：`6/6 已翻开`。
- 选择计数：`6/6 已选择`。
- 提交前按钮：非禁用。
- 提交接口：`POST /api/student/risk-profile` 返回 200。
- 持久化结果：`persisted: true`，`selectedAnswers: 6`。
- 页面错误：`consoleErrors: []`，`pageErrors: []`。
- 横向溢出：`overflow: false`。

截图：

- `.tmp/risk-profile-flipcards/current-01-backs.png`
- `.tmp/risk-profile-flipcards/current-02-fronts-selected.png`
- `.tmp/risk-profile-flipcards/current-03-after-submit.png`
- `.tmp/risk-profile-flipcards/design-qa-comparison.png`

### 视觉 QA

`design-qa.md` 已完成源图、卡背状态、翻开选择状态的并排比较，结论为 `final result: passed`。

### 自动化与构建

- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。
- `npm test -- src\lib\risk-profile.test.ts`：1 个文件 / 3 条测试通过。
- `npm test -- src\components\student\student-risk-profile-dashboard.test.tsx`：1 个文件 / 9 条测试通过。
- `npm test`：95 个测试文件 / 644 条测试通过。
- `npm run build`：Next.js 生产构建通过，61 个页面完成生成。
- `python -m code_review_graph update`：图谱刷新成功。
- `python -m code_review_graph detect-changes --brief --base HEAD`：未发现测试缺口，整体风险分 `0.00`。

### 本轮修正

- 全量测试暴露一条旧测试仍按“选项可直接点击”的旧行为断言。
- 该测试已更新为“先点击卡背翻开，再选择第一项”，与新需求和真实浏览器交互保持一致。

## 后续可选优化

- 为移动端增加一个“只看未完成卡片”的小型筛选，降低长页面滚动成本。
- 若后续接入真实插画资源，可把 inline SVG 替换为统一品牌插画文件，但当前实现已经满足用户允许的 SVG / 图形元素要求。
- 可增加针对翻卡交互的 Playwright spec，纳入 CI，而不仅作为本地 QA 脚本执行。
