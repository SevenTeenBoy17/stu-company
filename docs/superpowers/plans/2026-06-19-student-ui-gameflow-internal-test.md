# Brown Zone 学生端游戏化 UI 三轮内测与盲盒角色升级记录

> 日期：2026-06-19
> 范围：学生端任务中心、任务盲盒、右侧任务队列、3D 卡通角色资产、滚动提示、自动化回归。

## 本轮目标拆解

1. 任务盲盒栏和右侧任务队列不再使用单调模板，改为对应的卡通 3D 角色图案。
2. 角色风格走“玩具体块感、圆润表情、幽默卡通 3D”，适合 14-19 岁学生用户。
3. 每个可见任务盲盒要有独立形象，避免同屏重复。
4. 图片需要以合适分辨率接入页面，主盲盒和队列缩略图都要清晰。
5. 右侧任务队列需要保留可滚动能力，并用透明玻璃感滚动区域与明确提示告诉用户可继续下滑。
6. 交付前必须经过桌面、平板、手机三轮视觉化测试，并通过交互回归测试。

## 已完成改动

| 模块 | 改动 | 证据 |
| --- | --- | --- |
| 3D 角色资产 | 使用生图工具生成原创 4x3 卡通角色表，再裁切为 12 张 512px WebP 角色图。 | `public/brand/quest-world/quest-character-sprite-sheet.png`、`public/brand/quest-world/characters/*.webp` |
| 任务盲盒主卡 | `QuestBlindBoxArt` 接入角色图，主卡约 176px 优化加载，保留徽章、星球、任务编号和独立主题色。 | `src/components/student/student-quest-dashboard.tsx` |
| 右侧任务队列 | 队列缩略卡同步显示对应 3D 角色图，并通过 `data-theme` 保证同屏主题不重复。 | `tests/e2e/student-gameflow-regression.spec.ts` |
| 滚动体验 | 新增 `quest-glass-scroll` 玻璃滚动条，队列设置独立滚动区，并在下方展示“向下滑动查看更多”。 | `src/app/globals.css`、`quest-queue-scroll-hint` |
| 交互链路 | E2E 覆盖学生登录、任务页渲染、图片加载、队列可滚动、翻卡、详情弹窗打开和关闭。 | `tests/e2e/student-gameflow-regression.spec.ts` |

## 三轮视觉化测试

| 轮次 | 视口 | 截图 | 检查结果 |
| --- | --- | --- | --- |
| 第 1 轮 | 桌面 1440x1100 | `test-results/quest-3d-round1-desktop.png` | 无横向溢出；10 个角色图加载；右侧队列可滚动；提示条位于滚动区下方，不遮挡卡片。 |
| 第 2 轮 | 平板 768x1024 | `test-results/quest-3d-round2-tablet.png` | 单列/分区重排正常；盲盒图清晰；任务队列保留玻璃滚动区域和下滑提示。 |
| 第 3 轮 | 手机 390x844 | `test-results/quest-3d-round3-mobile.png` | 无横向溢出；角色图按移动端尺寸加载；队列和盲盒上下排列后仍可阅读和操作。 |

### 自动化视觉指标

| 指标 | 桌面 | 平板 | 手机 |
| --- | ---: | ---: | ---: |
| 横向溢出 | 否 | 否 | 否 |
| 盲盒数量 | 10 | 10 | 10 |
| 同屏主题唯一数 | 10 | 10 | 10 |
| 图片加载完成 | 是 | 是 | 是 |
| 队列可滚动 | 是 | 是 | 是 |
| 玻璃滚动类生效 | 是 | 是 | 是 |
| 下滑提示可见 | 是 | 是 | 是 |

## 验证命令

```powershell
git diff --check
npm run lint
npx tsc --noEmit
npm run test -- src/components/student/student-quest-dashboard.test.tsx
$env:PLAYWRIGHT_PORT='3000'; npx playwright test tests/e2e/student-gameflow-regression.spec.ts --project=chromium
npm run build
python -m code_review_graph update
python -m code_review_graph detect-changes --base HEAD --brief
```

## 验证结果

- `git diff --check`：通过。
- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- 组件测试：`1 passed`，共 `4 passed`。
- E2E：`2 passed`，覆盖任务页盲盒与自动投资页回归。
- `npm run build`：通过，Next.js 生产构建成功。
- `code-review-graph detect-changes --base HEAD --brief`：无受影响流程或测试缺口，风险分 `0.00`。

## 剩余说明

- 本轮只围绕任务盲盒与任务队列做 UI、资产和交互验证，不修改 API、数据库、登录或支付链路。
- `student-auto-invest-dashboard.tsx` 存在此前未提交的布局改动，本轮只用其 E2E 做回归验证，没有继续扩大修改范围。
- 新角色资产属于原创教学演示素材，未复用第三方 IP 或截图。
