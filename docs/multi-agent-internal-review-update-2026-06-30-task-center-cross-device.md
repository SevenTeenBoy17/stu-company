# 任务中心跨设备内测与翻卡密度修复

日期：2026-06-30

## 本轮目标

围绕学生端 `/student/quests` 的任务中心继续做多代理内测，重点验证“任务卡翻卡”在桌面、平板、手机上的阅读密度、交互可达性和视觉完整性。

## 多代理审阅摘要

- 产品/视觉审阅：任务中心的动物角色与翻卡方向成立，但移动端任务航线区纵深仍偏长，建议优先压缩卡片高度而不是重写整页。
- 学习体验审阅：卡背到卡面的渐进披露适合 14-19 岁学生，细节页要持续强化“为什么重要”和“下一步做什么”。
- QA 覆盖审阅：已有桌面和移动 reduced-motion E2E，但 tablet 断言仍偏少；本轮补强移动端高度回归指标，后续可继续补 tablet 自动断言。

## 实施改动

- 将 `MissionRouteNode` 小屏高度从桌面固定 `176px` 改为 `148px -> sm:176px` 的响应式高度。
- 小屏下同步压缩任务航线卡背/卡面 padding、角色头像、标题字号和内部间距，保留按钮 `min-h-11` 以维持触控可用性。
- 将 `QuestCommanderPanel` 指挥官插画区小屏最小高度从 `320px` 降到 `260px`，平板/桌面仍保持原本视觉气势。
- 在移动端 reduced-motion E2E 中新增 commander 面板高度阈值断言，防止后续再次变成长纵深卡片堆。

## 视觉证据

截图目录：

`docs/internal-playtest-screenshots/2026-06-30-task-center-cross-device-fix/`

核心指标：

```json
{
  "desktop": { "overflow": false, "commanderHeight": 600 },
  "tablet": { "overflow": false, "commanderHeight": 896 },
  "mobile": { "overflow": false, "commanderHeight": 1238, "badText": [] }
}
```

上一轮手机端 commander 面板约 `1360px`，本轮降至 `1238px`，同时保持翻卡、角色图、进度条和返回动作可见。

## 验证结果

```text
npm test -- src/components/student/student-quest-dashboard.test.tsx
PASS: 1 file / 7 tests

npx playwright test tests/e2e/student-gameflow-regression.spec.ts --grep "season mission cards" --project=chromium
PASS: 1 test

npx tsc --noEmit --pretty false
PASS

npm run lint
PASS

npm run build
PASS

python -m code_review_graph update
python -m code_review_graph detect-changes --brief --base HEAD
PASS: Overall risk score 0.00
```

## 仍建议后续补强

- 给 `/student/quests` 增加 tablet 宽度下的 durable Playwright 断言。
- 给任务中心翻卡补 keyboard-only 场景：Tab 聚焦卡背，Enter 翻开，焦点落到“选择航线/去完成”。
- 继续检查队列滚动区的触摸滚动、键盘滚动和长页返回锚点。
