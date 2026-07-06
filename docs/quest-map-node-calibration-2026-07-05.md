# 任务地图节点校准与状态视觉升级记录

日期：2026-07-05

## 本轮问题

用户截图指出任务地图中的任务节点没有落在地图光圈位置上，长胶囊标签漂浮在路线中间，导致“关卡地图”的空间关系不清晰。

## 设计决策

- 地图底图只负责场景、路线和发光平台，不内嵌文字或按钮。
- 可交互关卡全部由 HTML 节点叠加，便于状态、键盘焦点、屏幕阅读器和测试验证。
- 状态语义统一为三类：
  - 已完成：青绿色高亮，表示已经通关。
  - 进行中：琥珀金色高亮，表示当前可继续推进。
  - 未到达：深色低亮，表示尚未解锁或 0% 进度。
- 节点层改为覆盖整张地图舞台的绝对定位层，节点中心用百分比坐标绑定到发光平台。
- 标签从长胶囊改为短关卡牌，只显示 Route、状态与进度，详细标题留给底部路线卡和当前航线摘要。

## 资产更新

- 新生成并替换：`public/brand/quest-world/mission-route-map-v2.png`
- 分辨率：3840 x 2160
- 生成方式：内置 `image_gen` 工具生成，再本地高质量放大到 4K 横版。
- 最终 prompt 要点：夜间 3D 教育金融校园岛屿、六个清晰发光圆形平台、无文字、无角色、无 UI 标签、适合叠加 HTML 关卡点。

## 代码更新

- `src/components/student/student-quest-dashboard.tsx`
  - 新增 `QuestMapNodeState` 与状态样式映射。
  - 新增 `questMapNodePositions` 六个地图热点坐标。
  - 节点渲染改为“发光圆形关卡点 + 小状态牌”。
  - 地图背景图增加 `priority`，消除 LCP 图片加载提示。
- `tests/e2e/student-gameflow-regression.spec.ts`
  - 增加三态回归断言：至少存在 completed / current / locked。
  - 增加节点中心不得逃出地图层的几何断言。

## 验证证据

- `npx tsc --noEmit --pretty false`：通过。
- `npm test -- src/components/student/student-quest-dashboard.test.tsx`：8 passed。
- `PLAYWRIGHT_PORT=4327 npx playwright test tests/e2e/student-gameflow-regression.spec.ts --grep "quest hub supports commander|mission route cards can be revealed|tablet layout" --project=chromium`：3 passed。
- `npm run lint`：通过。
- `npm run build`：通过。
- 浏览器视觉脚本：
  - 无横向溢出。
  - 6 个节点存在。
  - 状态分布为 completed 2 / current 1 / locked 3。
  - 地图图像加载成功。
  - 控制台无 warning / error。
- 最终截图：`.tmp/quest-map-calibrated-1440-final.png`

## 仍可后续增强

- 如果后续任务数量超过 6 个，可把 `questMapNodePositions` 扩展为路线分支坐标，或按章节分页展示。
- 若需要更强“游戏关卡地图”反馈，可加入节点完成后的粒子奖励或路线光带逐段点亮动画。
