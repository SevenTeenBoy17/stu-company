# 2026-06-30 赛季任务翻卡多 Agent 内测跟进

## 参与视角

- 产品/教育游戏审阅：检查翻卡是否降低 14-19 岁学生的首屏认知负荷。
- 前端可访问性审阅：检查键盘、焦点、ARIA、触控面积和 reduced-motion 风险。
- QA 覆盖审阅：检查组件测试、E2E、移动端和空状态缺口。

## 发现的问题

1. 任务航线卡“翻开查看”会同步选中该航线，探索行为和选择行为混在一起。
2. 赛季任务正面的 `去完成` / `翻回卡背` accessible name 太泛，多个卡片同时翻开时对读屏和语音控制不友好。
3. 赛季任务正面按钮高度偏小，移动端触控舒适度不足。
4. 赛季目标为空时右侧区域会变成空白网格，缺少友好说明。
5. 缺少移动端 + reduced-motion 下直接点击赛季任务卡的 E2E 回归。

## 本轮修复

- 航线卡背点击现在只翻开任务说明，不再自动选中航线；必须点击正面 `选择航线` 才切换。
- 赛季任务正面按钮增加具体任务名的 `aria-label`。
- 赛季任务正面按钮与航线卡正面按钮提升到 `min-h-11`。
- 增加 `season-objectives-empty` 空状态。
- 增加移动端 `390x844` + `reducedMotion: "reduce"` 的 Playwright 翻卡回归测试。

## 验证证据

- `npm test -- src/components/student/student-quest-dashboard.test.tsx`：1 个测试文件、7 个测试通过。
- `npx playwright test tests/e2e/student-gameflow-regression.spec.ts --grep "season mission cards" --project=chromium`：1 个测试通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `python -m code_review_graph update && python -m code_review_graph detect-changes --brief --base HEAD`：风险分 `0.00`。

## 后续建议

- 如果继续任务中心内测，下一步建议做一次真实截图对比：桌面、平板、手机分别检查赛季任务区、任务航线区、任务锦囊区的视觉节奏是否一致。
- 后续可考虑给学生保留一个“快速查看全部目标”的轻量入口，服务于偏目标导向的学生，但不应默认恢复大段文字。
