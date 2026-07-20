# 2026-06-30 赛季任务翻卡交互补强

## 目标

把学生任务中心上方的赛季目标卡做成更明确的“任务卡背面 -> 任务正面”交互，减少默认态文字负担，提高拆卡式教育游戏体验。

## 本轮变更

- `SeasonObjectiveCreatureCard` 默认态调整为浅色动物收藏卡背面，保留角色、进度和“翻开任务”提示。
- 翻到正面后展示任务目标 `objective.detail`、概念标签、进度条、`去完成` 和 `翻回卡背`。
- 增加卡片高度，避免正面内容拥挤。
- 扩展组件测试，覆盖卡背提示、正面任务目标、可访问状态和行动入口。

## 验证

- `npm test -- src/components/student/student-quest-dashboard.test.tsx`：1 个测试文件、6 个测试全部通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `python -m code_review_graph update && python -m code_review_graph detect-changes --brief --base HEAD`：风险分 `0.00`。
- Playwright 本地烟测 `http://127.0.0.1:4173/student/quests`：登录成功、页面 200、识别 5 张赛季任务卡、点击首张后正面可见、无横向溢出。

## 备注

- 3001/3002 端口在本机被系统拒绝监听，本轮使用已有 4173 服务完成登录后交互烟测。
- 本轮只修改任务中心翻卡体验，不处理其他大范围 UI 或后端逻辑。
