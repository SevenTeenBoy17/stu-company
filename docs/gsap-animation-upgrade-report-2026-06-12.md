# GSAP 动画升级交付记录（2026-06-12）

## 交付结论

- 已研读官方仓库：`https://github.com/greensock/GSAP`
- 已安装项目依赖：`gsap@3.15.0`、`@gsap/react@2.1.2`
- 已完成学生端市场信息页动画升级，重点覆盖 K 线、趋势线、观察池卡片、AI 解读按钮与面板入场动效。
- 已部署上线到 Vercel 生产域名：`https://brown-zone-web.vercel.app`

## 实现范围

本轮明确改动范围集中在：

- `package.json`
- `package-lock.json`
- `src/components/student/student-market-board.tsx`

核心动画能力：

- K 线蜡烛逐根生长进入。
- 趋势线使用描边方式进入。
- 市场面板柔和渐显与轻微上移。
- 观察池股票卡片 hover 轻抬升。
- “让 AI 解读”按钮 hover 轻抬升。
- 环境光斑使用低频呼吸动效。
- 支持 `prefers-reduced-motion: reduce`，减少动效用户不会被强制播放动画。

## 验证记录

已通过：

```powershell
npm ls gsap @gsap/react
npx tsc --noEmit --pretty false
npm run lint
npm run test
npm run build
```

测试结果：

- `npm run test`：52 个测试文件通过，370 条测试通过。
- 本地 Playwright 桌面检查：`/student/market` 无横向溢出，动画目标存在。
- 本地 Playwright 移动端检查：`scrollWidth === clientWidth`，无横向溢出。
- 线上 Playwright 检查：学生账号可登录，`/student/market` 可进入，检测到 18 根 K 线、1 条趋势线、10 个观察池卡片、AI 按钮存在。

截图证据：

- `test-results/gsap-student-market-current-desktop.png`
- `test-results/gsap-student-market-current-mobile.png`
- `test-results/gsap-production-student-market.png`

## 部署记录

部署命令：

```powershell
npx vercel --prod --yes
```

部署结果：

- Production deployment ready.
- Alias 已指向：`https://brown-zone-web.vercel.app`
- 首页线上回查：HTTP 200
- 未登录访问 `/student/market`：HTTP 307，符合登录保护预期
- 登录后访问 `/student/market`：可正常进入

## Git 注意事项

当前工作树在本轮开始前已经存在大量历史未提交修改，且 `src/components/student/student-market-board.tsx` 本身也包含本轮之前的市场页/K 线布局改动。

因此本轮没有强行执行 `git add .` 或全量提交，避免把动画升级以外的历史改动混入一个不清晰的提交。

如果需要将当前线上生产态完整同步到 GitHub，建议下一步执行：

1. 先确认当前工作树所有修改都应进入仓库。
2. 运行 `git status` 与 `git diff --stat` 审核范围。
3. 按阶段拆分提交，至少不要使用 `git add .` 直接提交所有内容。
4. 对本轮 GSAP 动画可单独提交：依赖文件 + `student-market-board.tsx`。

## 后续建议

- 若继续打磨首页动画，可优先给首页 Hero 主视觉增加滚动进入和视差，但仍要尊重 reduced-motion。
- 若继续打磨按钮系统，可抽象一个统一的 `MotionButton`，避免每个页面重复 hover 动效。
- 当前项目已有 Framer Motion 和 GSAP，建议后续分工：页面级/组件状态动画继续用 Framer Motion，复杂 SVG/K 线/时间线动效用 GSAP。
