# Brown Zone 多 Agent 内测补充记录：学习榜 reduced-motion 修复

## 本轮目标

继续处理上一轮内部审阅记录中的可访问性问题：学生学习榜中点击区域卡片后会固定触发平滑滚动，未尊重 `prefers-reduced-motion`。这会让动效敏感用户在使用排行榜范围切换时产生不适，也不符合高质量教育产品的无障碍要求。

## 设计判断

- 保留默认用户的平滑滚动，让桌面端切换范围时仍有空间定位感。
- 对设置了“减少动态效果”的用户，改为即时滚动，避免强制动画。
- 不改变排行榜数据、排名逻辑、接口或视觉结构，只修正动效行为。

## 已处理内容

- `src/components/student/rank/power-card.tsx`
  - 新增 `preferredScrollBehavior()`。
  - `window.matchMedia("(prefers-reduced-motion: reduce)")` 为真时使用 `behavior: "auto"`。
  - 默认仍使用 `behavior: "smooth"`。
  - 给范围按钮增加稳定 `data-testid`，便于自动化覆盖。
- `src/components/student/rank/power-card.test.tsx`
  - 新增普通模式测试：点击范围按钮后调用 `scrollIntoView({ behavior: "smooth", block: "nearest" })`。
  - 新增 reduced-motion 测试：点击范围按钮后调用 `scrollIntoView({ behavior: "auto", block: "nearest" })`。

## 验证证据

- `npm test -- src/components/student/rank/power-card.test.tsx` -> 1 file / 2 tests passed
- `npx tsc --noEmit --pretty false` -> PASS
- `npm run lint` -> PASS
- `npm run build` -> PASS
- `python -m code_review_graph update && python -m code_review_graph detect-changes --brief --base HEAD` -> risk score 0.00

## 下一轮建议

- 给市场页 K 线、雷达图和趋势图补充等价文本摘要。
- 继续检查 `GlobalAiAssistant` 等共享组件里的固定 `smooth` 滚动是否需要同样适配 reduced-motion。
- 继续清理奖励命名中的“稀有/史诗”等抽卡刺激词。
