# 任务中心任务地图升级记录 - 2026-07-05

## 目标

把学生端 `/student/quests` 中的「任务地图」从普通卡片网格升级为更像游戏闯关的路线地图：有路线世界、节点、当前航线、进度反馈和赛季副地图，同时保留原有任务切换与可访问性测试钩子。

## 设计依据

- 游戏化学习路线应把线性课程转成可导航旅程，突出节点、阶段材料、评估与里程碑。参考：[How to create an interactive map for gamified learning routes](https://gamestrategies.io/en/blog/how-to-create-an-interactive-map/)。
- 系统状态可见性要求界面持续回答「当前状态是什么、下一步能做什么、操作是否生效」。参考：[NN/g Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/)。
- 进度反馈应明确告诉用户已完成多少、剩余多少，降低不确定感。参考：[NN/g Progress Indicators](https://www.nngroup.com/articles/progress-indicators/)。

## 生成资产

- 新增资产：`public/brand/quest-world/mission-route-map-v2.png`
- 生成方式：内置 `imagegen` / `gpt-image-2` 路线图概念资产
- 输出尺寸：最终项目资产已高质量缩放为 `3840 x 2160`
- 用途：作为任务地图主舞台背景，承载 6 个航线节点和当前航线说明

核心提示词摘要：

```text
Create an ultra high definition premium gamified learning route map background for a teen financial literacy sandbox.
Deep navy twilight, warm amber lantern glow, muted teal highlights.
6 checkpoint areas, campus finance world, savings vault, portfolio lab, market observatory, risk shield station.
No readable text, no logos, no people, no gambling/casino imagery, no watermark.
```

## 实现变更

- `src/components/student/student-quest-dashboard.tsx`
  - 重构 `QuestMapGallery` 为「地图舞台 + 航线摘要卡 + 赛季副地图」。
  - 主舞台使用生成地图背景、深色渐变遮罩和 6 个可点击航线节点。
  - 保留 `quest-task-map-node-*`、`quest-season-map-node-*`、`aria-pressed` 和 `onSelect` 交互。
  - 增加当前航线卡，显示任务目标、状态、进度条。
  - 右侧赛季地图改为自然高度，不再被主地图强行拉伸出大留白。
  - 增加 `scroll-mt-24`，避免移动端滚动到地图时被顶部紧凑导航遮挡。
- `tests/e2e/student-gameflow-regression.spec.ts`
  - 更新任务地图布局断言，验证新版「主地图更宽、赛季副卡自然高度、顶部对齐」而不是旧版等高双栏。

## 验证证据

- `npx tsc --noEmit --pretty false`：通过。
- `npm test -- src/components/student/student-quest-dashboard.test.tsx`：1 个文件 / 8 个测试通过。
- `npm run lint`：通过。
- `npm run build`：通过，61 个页面生成成功。
- `PLAYWRIGHT_PORT=4327 npx playwright test tests/e2e/student-gameflow-regression.spec.ts --grep "quest hub supports commander|mission route cards can be revealed|tablet layout" --project=chromium`：3 个 E2E 测试通过。
- Playwright 自测截图与指标：
  - `.tmp/quest-map-upgrade-qa/desktop-1440-quest-map-gallery-final.png`
  - `.tmp/quest-map-upgrade-qa/mobile-390-quest-map-gallery-final.png`
  - `.tmp/quest-map-upgrade-qa/metrics-final.json`
- `python -m code_review_graph update`：图谱刷新成功。
- `python -m code_review_graph detect-changes --base HEAD --brief`：风险分 `0.00`，无测试缺口。

## 插件、Skill 与降级情况

- 使用 `dev-supervisor`：监督本轮目标、YOLO/T2 守卫、时间线与降级记录。
- 使用 `frontend-design`：确定任务地图应从普通网格升级为高层次闯关地图舞台。
- 使用 `imagegen`：生成并接入新的超高清任务路线图。
- 使用 `code-review-graph`：完成实现后的审阅门禁。
- 尝试 `browser` 插件：当前运行时未暴露说明中要求的 `browser.documentation()`，按监督降级规则改用 Playwright。
- 未使用 `jam`、`box`、`edX`、`DataCamp`、`openai-developers`：本轮没有可关联的录屏会话、云文件、课程数据或 OpenAI API 文档需求。

## 后续建议

- 若继续打磨，可把主舞台节点与下方航线摘要卡做联动高亮动画。
- 可在移动端进一步提供「地图 / 航线卡」分段切换，以减少长页面滚动。
- 若要上线部署，需要另开 T3 部署阶段并由用户明确批准。
