# 交互控件（按钮/表单/链接）可用性审计报告

> **产品**：Mr.Brown AI 经济沙盘（Brown Zone）
> **审计范围**：登录后（及游客进入后）+ 公开页全部 `<button>` / `<a>`·`<Link>` / `<form>` / `<input>·<select>·<textarea>` / 可点击元素
> **问题**：是否存在「**看起来能点、实际是静态摆设 / 不可交互正常使用**」的功能部分？
> **审计日期**：2026-06-01
> **结论**：✅ **未发现任何死控件 / 静态不可交互控件。** 全部约 **165 个交互控件**逐一核对均已正确接线；1 处非阻断的控制台噪声（见 §4）。

---

## 1. 方法（三重交叉验证）

1. **静态代码逐控件核对**（权威）：React 事件委托在根节点，DOM 上看不出某按钮是否绑定了 `onClick`，故以**代码**为准。派 4 个前端 agent + 人工补漏，覆盖**全部 27 个组件文件 + 所有 page/layout**，对每个控件追踪其 handler / href / submit 是否真正做事。
2. **Playwright 活体 DOM 扫描**：逐页枚举控件，检出 DOM 可见的死信号——占位/死链 `href`（`#`、空、`javascript:`、指向不存在的锚点 id）、无可访问名按钮（无文字且无 `aria-label`/`title`）、控制台 error、未捕获异常。
3. **既有 e2e 流程执行覆盖**：`tests/e2e/prelaunch.spec.ts` 已实测登录提交、游客进入、`venture` 交易、家长支付下单/完成等**核心流程真实执行成功**——证明关键控件在运行时确实触发后端。

## 2. 覆盖与活体扫描结果

| 页面 | 链接 | 按钮 | 输入 | 死链 | 无名按钮 | 控制台 error | 未捕获异常 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/`（首页） | 14 | 3 | 0 | 0 | 0 | 0 | 0 |
| `/learn` | 18 | 8 | 1 | 0 | 0 | 0 | 0 |
| `/demo` | 10 | 11 | 0 | 0 | 0 | 0 | 0 |
| `/pricing` | 12 | 5 | 0 | 0 | 0 | **2** ⚠️ | 0 |
| `/student`（游客） | 10 | 23 | 3 | 0 | 0 | **0** ✅ | 0 |
| `/student`（学生） | 10 | 29 | 3 | 0 | 0 | 0 | 0 |
| `/student/market` | 10 | 12 | 1 | 0 | 0 | 0 | 0 |
| `/student/history` | 10 | 12 | 0 | 0 | 0 | 0 | 0 |
| `/teacher` | 6 | 2 | 4 | 0 | 0 | 0 | 0 |
| `/parent` | 6 | 2 | 0 | 0 | 0 | 0 | 0 |
| `/admin` | 6 | 14 | 18 | 0 | 0 | 0 | 0 |

> `/student`（游客）控制台 **0 error** = 上一轮修复的 Hydration 报错已确认消除。

## 3. 静态核对：全部 WIRED（零死控件）

逐文件核对要点（无一例外均已接线）：

- **核心循环**（`student-sandbox.tsx`）：事件抉择、推进回合、赛季重玩、资产选择、动作 Tab、trade/bank/property/venture 提交、问 AI ——全部 `onClick→submitAction/setState/dispatchAssistantOpen`；所有 `<select>/<input>` 均有 `onChange`；所有 `disabled` 均状态驱动（`pending`/`!selectedAsset`）。
- **认证/演示**（`demo-portal.tsx`）：登录/注册/游客/邀请码/忘记密码——按钮 `onClick→fetch` 真实接口；输入双向绑定；`disabled` 由 `busyAction` 驱动。无 `<form>` 元素（采用「按钮 + `onClick→fetch`」模式，故不存在"表单无 `onSubmit`"问题）。
- **支付/家庭组**（`wechat-checkout-button.tsx`、`guest-upgrade-checkout.tsx`、`family-manager.tsx`、`subscription-banner.tsx`）：下单、模拟完成、生成家长付款链接、复制链接、加入/移出孩子——全部 `onClick→fetch`（prepay / mock-complete / parent-link / family/members）；`readOnly textarea` 为二维码/链接展示（刻意只读 + `onFocus` 选中，便于复制），非死输入。
- **控制台**（`teacher-console.tsx`、`admin-user-manager.tsx`）：发布任务、查询、保存配置、改邮箱、重置密码、创建账号、筛选——全部接 `fetch`；`disabled={!canManagePasswords}`（只读模式）/`disabled={Boolean(busyAction)}`（请求中）均为有意的条件禁用。
- **外壳/营销**（`site-header.tsx`、`site-footer.tsx`、`platform-layout.tsx`、`learn-catalog.tsx`、各 `page.tsx`）：导航/CTA 全部为指向**存在路由**的 `<Link href>`；菜单/抽屉/Tab 为 `onClick` 状态切换；首页区块 `id`（`method/business/safety`）存在，无指向缺失锚点的死链。

**无任何**：`href="#"` / 空 href / `javascript:void`、空 `() => {}` / 仅 `console.log` / `alert()` 占位 handler、`// TODO`/"敬请期待"/"暂未开放" 桩、硬编码 `disabled={true}`、无 `onClick` 的 `cursor-pointer`/`role=button` div、无 `onChange` 的伪输入。

## 4. 唯一观察项（非死控件 · 非阻断）

**`/pricing` 匿名访问时 2 条控制台 401**：
- **现象**：`Failed to load resource: 401 (Unauthorized)` ×2。
- **来源**：页面两个 `WechatCheckoutButton` 在 `useEffect` 挂载时各请求一次 `/api/billing/status`（用于父/师代付时的「开通对象」下拉）；匿名用户该接口返回 401。
- **是否死控件**：**否**。组件已优雅吞掉（`if (!response.ok) return null` + `.catch()`），按钮完全可用——匿名用户点击下单会经 prepay 的 401 分支 `window.location.href = "/demo?reason=login_required"` 跳转登录（符合预期）。
- **性质**：浏览器对失败网络请求的日志噪声，**不影响功能**。
- **可选优化（非必须）**：① `WechatCheckoutButton` 仅在需要时（点击后）再拉 `/api/billing/status`，或挂载前先判断登录态；② 让 `/api/billing/status` 对匿名 GET 返回 `200 { eligibleTargets: [] }` 而非 401（需确认不影响 `FamilyManager`/`subscription-banner` 等其它调用方——它们均在已登录页，返回 200，不受影响）。
  - 因属纯日志噪声、且改动有轻微回归面，本次**未擅自修改**，留待按需处理。

## 5. 复现

```powershell
# 活体扫描：逐页枚举控件 + 死链/无名/控制台 error
npx playwright test tests/e2e/interactivity-audit.spec.ts --project=chromium --workers=1
#  → test-results/interactivity/findings.json
```

- 静态核对由 4 个前端 agent 完成（覆盖 `src/components/**` 全部 27 文件 + `src/app/**/page.tsx`·`layout.tsx`）。
- 既有 `tests/e2e/prelaunch.spec.ts` 覆盖核心流程的真实执行（登录/游客/交易/家长支付）。

---

*结论：所有按钮、表单、链接均可正常交互；不存在静态不可用控件。唯一观察项为 `/pricing` 匿名态的无害 401 日志噪声。*
