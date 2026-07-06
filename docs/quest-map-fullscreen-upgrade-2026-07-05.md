# 任务地图全屏查看与视觉去重叠升级记录

日期：2026-07-05

## 目标

解决任务地图中文字互相重叠、地图信息拥挤的问题，并新增一个“放大查看”按钮，让学生可以近全屏查看任务地图细节。

## 设计原则

- 常规视图只显示地图、关卡头像节点和编号，不再在地图路径上叠加 Route 文本标签。
- 任务文字信息保留在下方路线卡和当前航线摘要里，避免地图本身拥挤。
- 放大视图使用近全屏弹窗，地图主体仍只放节点；底部固定显示当前航线详情，点击节点可切换详情。
- 状态颜色继续保持三态：
  - 已完成：青绿色发光。
  - 进行中：琥珀金色高亮。
  - 未到达：暗色低亮。

## 生图资产

- 资产路径：`public/brand/quest-world/mission-route-map-v2.png`
- 分辨率：3840 x 2160
- 工具：内置 `image_gen`
- 设计要求：六个清晰发光平台、S 形路线、夜间校园岛屿、左上留白、无文字、无标签、无 UI 按钮，便于 HTML 节点叠加。

## 前端实现

- 文件：`src/components/student/student-quest-dashboard.tsx`
- 新增按钮：`data-testid="quest-map-expand-button"`
- 新增弹窗：`data-testid="quest-map-fullscreen-dialog"`
- 新增全屏节点：`button[data-testid^="quest-map-fullscreen-node-"]`
- 常规地图节点只保留数字编号，因此自动检查要求节点文本符合 `^\d+$`。
- 全屏弹窗支持：
  - 点击“放大查看”打开。
  - 点击关闭按钮或按 Escape 关闭。
  - 点击节点切换当前航线。

## 回归测试

- 文件：`tests/e2e/student-gameflow-regression.spec.ts`
- 新增断言：
  - 常规地图存在 completed / current / locked 三态节点。
  - 节点中心不逃出地图层。
  - “放大查看”按钮可打开全屏弹窗。
  - 全屏弹窗中有 6 个可点击节点。
  - Escape 可关闭弹窗。

## 验证证据

- `npx tsc --noEmit --pretty false`：通过。
- `npm test -- src/components/student/student-quest-dashboard.test.tsx`：8 passed。
- `PLAYWRIGHT_PORT=4327 npx playwright test tests/e2e/student-gameflow-regression.spec.ts --grep "quest hub supports commander|mission route cards can be revealed|tablet layout" --project=chromium`：3 passed。
- `npm run lint`：通过。
- `npm run build`：通过。
- 视觉脚本：
  - 常规地图无横向溢出。
  - 常规地图 6 个节点都只有数字文本。
  - 全屏地图 6 个节点都只有数字文本。
  - 弹窗打开与 Escape 关闭均成功。
  - 控制台无 warning / error。

## 截图证据

- 常规地图：`.tmp/quest-map-compact-upgrade-final2.png`
- 放大地图：`.tmp/quest-map-fullscreen-upgrade-final2.png`

## 后续可选增强

- 可为当前航线增加从节点到详情卡的轻微光线连接动画。
- 可在全屏视图中加入缩放滑杆或拖拽平移，但当前版本先优先稳定和易读。
