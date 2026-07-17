# 内测马拉松 itest9 —— 系统性 WCAG 2.1 AA 无障碍审计（2026-07-17）

> 承接 itest6→itest8 的对抗式全流程内测。前八轮以功能正确性 / 认证 / 并发 / 计费 /
> 性能为主轴，本轮切换到一个此前**单维扫描漏掉的整类问题**：全站键盘 / 读屏 /
> 色觉可及性。采用「系统性遍历 + 逐条 WCAG 成功准则定位」而非抽查，一次性收敛
> 28 个确认项。方法论要点：**用发现问题的同一手段验证修复**——axe-core 组件渲染
> 用例锁死可自动断言的项，浏览器实测锁死运行时行为（抽屉焦点契约）。

## 一、审计范围与产出

- **依据**：WCAG 2.1 Level AA。逐条落到成功准则编号（1.1.1 / 1.3.1 / 1.4.1 /
  1.4.3 / 1.4.11 / 2.1.2 / 2.4.3 / 2.4.6 / 3.3.1 / 3.3.2 / 4.1.2 / 4.1.3）。
- **确认项**：28 条（原始清单见 scratchpad `itest9-a11y.md`）。P1×2 / P2×18 / P3×8。
- **交付**：两批提交到 PR #18 分支 `feat/itest6-clickthrough-qa`。
  - `199a1d0` 首批 18 修（选择卡 aria-pressed / 焦点环 / 对比度 / 标题 h1 / KeyAI 对话）
  - `b3b33d2` 次批 12 修（aria-live / 抽屉 dialog / 标题层级衔接 / 1.4.1 / 图表替代文本）

## 二、按 WCAG 成功准则归类的修复

### 4.1.2 名称·角色·值 —— 选择态与可及名（P1/P2）
- **选择卡 `aria-pressed`**：risk-profile / credit-lab / auto-invest / life-cashflow /
  fund-lab / goal-accounts / protection-umbrella / sandbox（动作 Tab）/
  market-board（资产·自选卡）——此前选中态仅靠颜色，读屏无法判断当前选中项，
  系统性补 `aria-pressed={active}`。
- **auto-invest 标的选择器**：`aria-labelledby="…asset-label"` 把可及名覆盖成静态
  「定投标的」、盖掉了按钮内已选标的文本 → 改 `aria-label`，折叠态也能播报当前值。
- **表单可及名**：teacher-console「发起任务」4 个输入（首批补 `<label>`）；
  admin 筛选 + 新建共 4 个角色·订阅 `<select>` 补 `aria-label`（编辑区已有 `<span>` 标签）。

### 4.1.3 状态消息 —— aria-live 动态区（P2/P3）
- 操作结果提示补角色：sandbox / fund-lab / admin-user-manager / demo-portal 的
  消息容器加 `role={tone==='error'?'alert':'status'}`（错误 assertive、其余 polite）。
- KeyAI 对话记录（首批）`role="log" aria-live="polite" aria-relevant="additions"`；
  错误 `role="alert"`；statusNote `role="status"`。
- rank-board 榜单结果区加 `aria-live="polite" aria-busy={showSkeleton}`，
  地区/周期切换异步刷新对读屏可感知。
- rank-onboarding 校验失败提示加 `role="alert"`。

### 1.3.1 / 2.4.6 标题层级（P2）
- platform-layout 页面主标题 `<p>`→`<h1>`（移动 + 桌面双处，保留 `text-h1` 视觉），
  使每个平台页有唯一 h1。
- 衔接连续层级：teacher-console 4 个 `bz-eyebrow` 板块标题 → `<h2>`；
  rank-board「学习进度榜」、power-card「学习点是怎么算出来的」`h3`→`h2`，
  恢复 h1→h2→h3 无跳级。

### 1.4.11 焦点可见（P2）
- `--color-ring` 由半透明 `rgba(240,138,56,0.45)`（浅底 1.5:1 / 深底 2.4:1）改为
  不透明高对比 `#d9660f`（≥3:1）；新增 `--warning-700`。

### 1.4.3 文本对比（P2/P3）
- rank-board 二级标签/匿名头像 `fg-subtle`→`fg-muted`；manual-payment `slate-400`→`600`；
  subscription-banner `warning-600`→`700`；risk-profile「待选择」`slate-500`→`600`；
  KeyAI 历史时间 `slate-400`→`600`。

### 2.1.2 / 2.4.3 键盘陷阱与焦点顺序（P2/P3）
- **site-header 移动抽屉**：`<aside>` 补 `role="dialog" aria-modal aria-label tabIndex=-1`；
  打开→焦点移入抽屉、Esc 关闭、关闭→焦点交还汉堡按钮；触发按钮补
  `aria-haspopup="dialog" aria-expanded`。**浏览器实测**：开→`activeEl=dialog`/
  `aria-expanded=true`；Esc→`dialogPresent=false`/`focusReturnedToTrigger=true`。
- **rank-dashboard 编辑档案**：整视图切换时焦点会掉到 body → 进入编辑态焦点移入
  表单区（`tabIndex=-1` 容器）、返回交还「编辑档案」按钮，形成可预期焦点回路。

### 1.4.1 不仅靠颜色（P3）
- history 复盘「风险分 / 纪律分」双折线加 实线 / 虚线 线型冗余编码 + 图例同步用
  实/虚线示意，色觉障碍用户不依赖颜色即可区分。

### 1.1.1 非文本内容（P2/P3）
- parent 净值走势图（纯 `div` 柱状图）补 `role="img"` + 汇总各回合金额的 `aria-label`
  （原先数值仅藏在 `title`，读屏只剩「R1 R2…」轴标签）。
- protection 雷达 SVG、fund-lab sparkline 为装饰图（数据已有文本等价物）→ `aria-hidden`。

### 3.3.1 / 4.1.2 表单校验（P3）
- rank-onboarding 必填学校 / 昵称补 `aria-required`。

## 三、复验（真实命令输出）

```
npx tsc --noEmit           → exit 0
npm run lint               → exit 0
npm run test               → 106 files / 692 tests passed（+3 新 axe 用例）
npm run build              → exit 0（全路由生成）
```

- **axe-core 组件护栏**：`student-panels-a11y.test.tsx` 扩 fund-lab / protection /
  life-cashflow 三个渲染断言用例，`toHaveNoViolations()` 全绿（8/8），锁死本轮
  aria-pressed / aria-live / aria-hidden 修复不回退。
- **浏览器实测**：dev :3100 mobile 视口，site-header 抽屉开→Esc 全链路 DOM 断言
  通过，无 console error。

## 四、方法论沉淀

1. **单维扫描的盲区是「整类」而非「个例」**：前八轮功能内测 0 崩溃，但无障碍是一个
   正交维度——一次系统性遍历就浮出 28 条，说明抽查式验证会漏掉一整类用户群
   （键盘 / 读屏 / 色觉）。定期做**维度切换**的全量审计比在同一维度加深更划算。
2. **可自动断言的 a11y 一定要落测试**：axe-core 在 jsdom 里无法算色彩对比（已在
   `COMPONENT_AXE_OPTIONS` 关掉 `color-contrast` / `region` / `page-has-heading-one`），
   但结构类违规（缺可及名、role 误用、live 区）能可靠断言——这些正是最易回退的项，
   必须进护栏用例。对比度这类只能人工/构建外校验的，靠 token 集中管理防扩散。
3. **运行时行为用浏览器锁**：抽屉的 Esc + 焦点归还是 `useEffect` 命令式逻辑，
   jsdom 渲染断言覆盖不到「Esc 后焦点回到触发器」——用真浏览器 DOM 断言补齐。

## 五、遗留

- 本轮纯前端 JSX/CSS + 一处 Server Component 的 `aria-label` 字符串，**不触及任何 API
  路由 / repo.ts / DB / 迁移**，api-probe 后端行为与 itest8 收敛时一致，无需重跑。
- PR #18 合并仍需用户在 GitHub 手动执行（self-authored + 生产部署触发，自动模式被
  分类器拦截，Claude 无法代为合并）。
