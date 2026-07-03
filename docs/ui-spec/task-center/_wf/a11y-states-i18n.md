## 无障碍、状态与国际化规范（任务中心 / Quest Hub）

**适用文件**：`src/components/student/student-quest-dashboard.tsx`（路由 `/student/quests`）。
**配套类型**：`StudentQuestItem` / `StudentQuestStatus` / `StudentBenefitStatus`（`src/lib/quests.ts`）、`QuestCard` / `QuestCardRarity`（`src/lib/cards.ts`，稀有度仅 `common | rare | epic`）。
**配套 API**：`/api/student/quests`（领取）、`/api/student/quests/draw`（抽卡）、`/api/student/season`（赛季）。
**配套动效令牌**：`premiumMotion`（`src/lib/motion-system.ts`）。

> 总原则：升级到「盲盒/潮玩」高保真观感时，**所有视觉糖（翻卡、揭示弹窗、稀有度光效）都必须有等价的非视觉、键盘可达、可降级路径**。绝不能为了潮玩感把现有的 `aria-hidden + inert` 翻卡模式、`role="status"` 抽卡播报或 `min-h-11/min-h-12`（≥44px）触达区域退化掉。

---

### 1. 对比度（WCAG-AA，在鲜艳/深色卡面上）

项目已踩过的坑（写在 `globals.css` 注释里）：`text-brand`（`--brand` = `--amber-500`）在浅底上**不达 AA**；浅底品牌文字必须用 `--amber-800`（`#944314`，约 5.8:1）。深色卡上的深琥珀 `text-warning`（`#854d0e`）仅约 2.9:1，必须换成浅色反相琥珀（`text-amber-300` / `text-amber-200`）。

#### 1.1 必须遵守的既定配色（不要回退）

| 场景 | 用 | 禁用 | 原因 |
| --- | --- | --- | --- |
| 浅卡面品牌文字（`bz-brand-text-on-light` / `Mission Box` eyebrow） | `var(--amber-800)` `#944314` | `text-brand`(`#f2a245`)、`--amber-700` | amber-700 在 `brand-soft` 上仅 ~4.0:1 |
| `brand-ink`（`--color-brand-ink`=`--amber-800`）正文 | 维持 | 不要改回 ink-800 派生 | 已校准为 ~5.8:1 |
| 深 `slate-950` 卡上的稀有度/品类标签 | `text-amber-300`(epic)、`text-amber-200`(risk)、`text-sky-200`、`text-brand-warm` | `text-warning`(`#854d0e`) | 深底 ~11.9:1 vs ~2.9:1 |
| 琥珀 CTA 上的文字（如「回到策略台执行」） | `!text-fg-default`（深墨，~8:1） | 继承的白色（~2.5:1） | 见组件第 1132–1135 行注释：基础 `a{color:inherit}` 会漏白 |
| 上涨数字 | `--color-up`=`--up-600` `#c52e1c`（白底 ~5.5:1） | `--up-500`/更亮值做小号文字 | 图表填充才用原始 `--up-500` |

#### 1.2 新增「色彩身份卡」的对比硬约束

潮玩 DNA 要求每张盲盒卡有独立色彩身份（`questBoxThemes` 的 `from/via/to` 渐变）。卡面上的文字必须用主题里**专门留出的高对比墨色变量**，不能直接把品牌文字铺在饱和渐变上：

- 文案叠在彩色渐变面板上 → 用 `text-[var(--quest-ink)]`（每个主题已定义深墨，如 fox `#1f1308`、turtle `#06261d`）配 `bg-white/58~72` 毛玻璃底（现有 `QuestBlindBoxArt` 已这样做，保留）。
- **新增白字铺在「编辑海报」实色背景（参考图 4：红/棕/海军蓝/橙/绿实色 + 大字 NAME）时**：必须验证白字 ≥ 4.5:1（大号 ≥18.66px 粗体可放宽到 3:1）。给四张实色定下**审核过的安全底色**，作为新主题字段（建议加 `posterBg` / `posterInkOnDark: '#ffffff'`）：

| 海报实色（建议值） | 白字比 | 判定 |
| --- | --- | --- |
| `#7c2d12`（砖红/狐） | ~8.9:1 | ✅ 正文/大字均可 |
| `#1e3a8a`（海军蓝/鲸） | ~10.4:1 | ✅ |
| `#365314`（深绿/猫） | ~7.8:1 | ✅ |
| `#581c87`（紫/狮） | ~9.6:1 | ✅ |
| `#ea580c`（橙/松鼠） | ~3.0:1 | ⚠️ 仅 ≥18.66px 粗体大字（NAME），正文必须改用 `--quest-ink` 深墨或加 `text-shadow` |
| `#f59e0b`（琥珀/鹿） | ~1.9:1 | ❌ 白字禁用；该卡海报字用 `text-[var(--quest-ink)]` 深墨 |

> 规则：**饱和度 ≥ 70% 且明度 ≥ 60% 的实色（橙/黄/浅绿/粉）一律不许铺白字**；这类卡走「深墨字 + 浅色徽章」方案（参考图 2 的 pastel 卡），与暗色海报卡（参考图 1/4）分流。

#### 1.3 稀有度的双重编码（不只靠颜色）

参考图用 ribbon/foil/glow 区分稀有度。**颜色不得作为唯一区分手段**（WCAG 1.4.1）。`rarityMeta` 的 `label`（`COMMON/RARE/EPIC`）已提供文字编码，必须始终随框/光效同时出现。建议增加形状/图标编码：

```tsx
const rarityMeta = {
  common: { label: "COMMON", icon: Circle,    frame: "single-stroke" },
  rare:   { label: "RARE",   icon: Diamond,   frame: "double-stroke" },
  epic:   { label: "EPIC",   icon: Sparkles,  frame: "foil-glow" },   // glow 仅装饰
};
```

光效（`shadow-glow` / `ring`）必须用 `aria-hidden` 包裹或纯 CSS `::after`，不进可访问名。

---

### 2. prefers-reduced-motion

组件已在 `useGSAP` 里检测 `matchMedia("(prefers-reduced-motion: reduce)")`，翻卡 `animateQuestCard` 也二次检测并用 `gsap.set`（瞬时到位）。升级后必须维持并扩展：

| 动效 | 正常 | reduce 降级 |
| --- | --- | --- |
| `[data-quest-reveal]` 入场（`power3.out`, stagger） | 保留 | `gsap.set(..., {autoAlpha:1, clearProps})`（已实现，勿删） |
| `[data-calendar-cell]` `back.out(1.4)` 弹入 | 保留 | 同上瞬时显示 |
| 翻卡 rotateY 180°（`premiumMotion.ease.reward`） | 保留 | `gsap.set(card,{rotateY:targetRotation})` 瞬翻（已实现） |
| **新增：抽卡英雄揭示**（盲盒爆开/卡片飞入/foil 扫光） | 缩放+发光时间线 | 直接 `autoAlpha:1, scale:1`，无粒子、无连续闪烁 |
| **新增：epic 卡 idle 光晕呼吸 / 角色漂浮** | `sine.inOut` 循环 | **完全停用**（reduce 下任何 `repeat:-1` 循环都要 kill） |

硬规则：
- 任何 `repeat: -1`（持续呼吸/漂浮/扫光）**必须**在 reduce 分支被 `gsap.killTweensOf` 或根本不创建，避免 WCAG 2.2.2「闪烁/移动内容」违规。
- 闪烁频率即使在正常模式也 < 3 次/秒（WCAG 2.3.1）。foil 扫光做成一次性、非循环。
- reduce 检测要在揭示触发点也复查（用户可能中途改系统设置）；沿用现有「翻卡时重新 `matchMedia`」的模式。

---

### 3. 键盘与焦点顺序

#### 3.1 翻卡（front / back 双面）

现状（保留）：单个可见卡用 `[data-quest-card-inner]` 3D 容器，正面 `quest-card-front-*` 与背面 `quest-card-back-*` 用 `aria-hidden={isFlipped}` + `inert={isFlipped}`（背面取反）互斥。这是**正确**的 3D 翻卡无障碍模式——隐藏面同时移出读屏树与 Tab 序。

必须维持的不变量：
1. **`aria-hidden` 与 `inert` 必须成对、取反**（`front: aria-hidden={isFlipped} inert={isFlipped}` / `back: aria-hidden={!isFlipped} inert={!isFlipped}`）。只设其一会让读屏读到隐藏面或焦点掉进 `inert` 子树。
2. 翻卡按钮 `quest-flip-*` 用 `aria-pressed={isFlipped}`（已实现）。补充 `aria-label`，因为视觉文字「拆开任务盲盒」翻面后变「返回任务」——给两态各自明确名：

```tsx
aria-pressed={isFlipped}
aria-label={isFlipped ? "已拆开，返回任务盲盒正面" : "拆开任务盲盒，查看任务目标"}
```

3. **翻面后把焦点移到新可见面的第一个交互元素**（背面的「查看任务详情」或「领取并抽卡」），否则焦点停在已 `inert` 的祖先上会丢失。在 `toggleQuestFlip` 回调里翻面动画结束后 `el.focus({preventScroll:true})`；reduce 模式立即 focus。
4. 翻回正面时焦点回到翻卡按钮本身。

E2E（`tests/e2e/student-internal-test.spec.ts` 已有翻卡用例）：断言翻面后 `quest-card-back-*` 内按钮 `:focus` 命中、`quest-card-front-*` 整树 `inert`。

#### 3.2 任务详情对话框 `QuestDetailDialog`

现状有缺陷，必须补全（当前只有 `role="dialog" aria-modal="true"`，**无焦点陷阱、无 ESC、无返回焦点、无 `aria-labelledby`**）：

| 要求 | 实现 |
| --- | --- |
| 可访问名 | `aria-labelledby` 指向标题 `<h3 id="quest-detail-title">{quest.title}</h3>` |
| 打开即聚焦 | 焦点落到「关闭」按钮（或对话框容器 `tabIndex={-1}` 后 focus） |
| 焦点陷阱 | Tab/Shift+Tab 在对话框内循环；只有「关闭任务详情」一个可聚焦元素时仍要拦住 Tab |
| ESC 关闭 | `onKeyDown` 监听 `Escape` → `onClose()` |
| 点遮罩关闭 | 点击 `bg-slate-950/56` 背板关闭；点内容区不关 |
| 返回焦点 | 关闭后焦点回到触发它的「查看任务详情」按钮（在父组件存 `lastTriggerRef` 或 `detailQuestId` 关联的按钮 ref） |
| 滚动锁 | 打开时 `document.body` 加 `overflow:hidden`，关闭恢复 |
| 渲染层级 | 现为内联 `fixed`；保留 `z-50`，无需 portal，但确保不被父级 `overflow-hidden`/`transform`（盲盒卡的 `[perspective]`）裁切——`QuestDetailDialog` 已在根 `div` 末尾渲染，远离卡片栈，OK |

> 复用建议：项目已有 `role="dialog"` 弹层经验，把上述焦点陷阱抽成 `useFocusTrap(ref, {onClose})` hook，详情框与下面的「获得」奖励弹窗共用。

#### 3.3 「获得 / 抽卡揭示」奖励弹窗（新增，参考图 4「吉祥物获得弹窗」）

当前抽卡结果只渲染在右侧 aside 的 `role="status"` 块（`quest-draw-result`），潮玩升级会加一个**庆祝式英雄弹窗**。它是 modal，对话框契约同 §3.2，外加：

- `role="dialog"` `aria-modal="true"` `aria-labelledby`（卡名）`aria-describedby`（teachingLine + 「仅装饰，不改变战力/净值」声明）。
- **不可用稀有度光效/动画当作唯一反馈**：弹窗内必须有文字「你抽到了 {name}（{RARE}）」。
- 焦点初始落到「收下卡片」主按钮；ESC / 遮罩 / 「收下」均关闭并返回焦点到「领取并抽卡」按钮。
- 与读屏播报协同：弹窗出现时不要再让 aside 的 `role="status"` 重复念一遍（见 §4，二选一，建议弹窗用 `role="dialog"` 即时聚焦播报，aside 残留态保留但不再触发新播报）。

---

### 4. 读屏播报（aria-live）

#### 4.1 奖励揭示与稀有度

现有右侧 aside 已有三个反馈块——`quest-claim-result`（`role="status"`）、`quest-draw-result`（`role="status"`）、`claimError`/`drawError`（`role="alert"`）。`role="status"` 隐含 `aria-live="polite"`，正确。升级保留并强化：

- **稀有度必须进播报文本**（不能只靠视觉 ribbon）。现有 `quest-draw-result` 已含「（{rarityMeta[rarity].label}）」——保留。建议用中文稀有度词更友好（见 §6 文案表：普通/稀有/史诗）。
- 播报文必须重申教育护栏：「这张卡只做装饰与复盘记录，不改变战力或净值。」（现有文案已含，保留）。
- 一次抽卡涉及两步（先 `claimQuest` 改 payload，再 `drawQuestCard`）会连续点亮两个 `status`。**避免双重轰炸**：把领取+抽卡合并成**一条** live 消息，或让 `quest-claim-result` 用 `aria-live="off"`、只让最终 `quest-draw-result` 播报。
- live 容器**必须在初始渲染时就存在于 DOM**（哪怕为空），后插内容；否则首次插入不被部分读屏播报。当前是条件渲染 `{drawResult && ...}`——改为常驻容器 + 内部条件内容：

```tsx
<div role="status" aria-live="polite" data-testid="quest-draw-result" className="...">
  {drawResult ? <>抽卡揭晓：你抽到了 {drawResult.card.name}（{rarityZh[drawResult.card.rarity]}）……</> : null}
</div>
```

#### 4.2 抽卡进行中 / 状态切换播报

- 「抽卡中…」状态：按钮文字已切换（`isQuestBusy ? "抽卡中..."`），同时给按钮 `aria-busy={isQuestBusy}`。
- 任务从「待领取」变「已收藏」：通过上面的 polite 区一并播报，不要额外 `alert`。
- 错误用 `role="alert"`（assertive，已实现）——保留，仅领取/抽卡失败用 alert，其余状态用 polite。

#### 4.3 进度条与百分比

各进度条（任务/权益/赛季）目前只有视觉 `width` + 旁边可见 `xx%`。给进度条容器补 ARIA，使读屏可独立读到：

```tsx
<div role="progressbar" aria-valuenow={Math.round(progress*100)} aria-valuemin={0} aria-valuemax={100}
     aria-label={`${quest.title} 完成度`}>
```

---

### 5. 全部 UI 状态

#### 5.1 任务状态机（`StudentQuestStatus` + 派生 `claimable/claimed`）

来源：`quests.ts` 的 `withClaimState`（`claimable = status==="done" && !claimed`）。前端再叠加 `claimingQuestId` / `drawingQuestId` 的瞬时态。完整状态表：

| 状态 | 触发条件 | 现有令牌/类 | 主按钮文案 | 按钮可用 | 读屏 |
| --- | --- | --- | --- | --- | --- |
| 待解锁 `locked` | 前置未完成（如 `cooldown-after-trade` 在 `lastTradeRound===0`） | `statusMeta.locked`：`bg-slate-100 text-slate-600` + `Lock` | 「完成后可抽卡」 | 禁用（`!canDraw`） | 「待解锁，先完成前置动作」 |
| 进行中 `active` | `0 < progress < 1` | `bg-brand-soft text-brand-ink` + `CircleDot` | 「完成后可抽卡」 | 禁用 | 「进行中，{xx}%」 |
| 需观察 `watch` | 行为偏离（如安全垫 `<12%`） | `bg-warning/10 text-warning` + `Clock3` | 同 active | 禁用 | 「需观察，{coachNote}」 |
| 待领取 `claimable` | `status==="done" && !claimed` | 主 CTA `bg-brand text-slate-950 shadow-glow` | 「领取并抽卡」 | 可用 | 「可领取盲盒奖励」 |
| 领取中 | `claimingQuestId===id \|\| drawingQuestId===id` | 同上 + `aria-busy` | 「抽卡中…」 | 禁用（`claimingQuestId!==null`） | 「正在领取并抽卡」 |
| 已收藏 `claimed` | 抽卡成功，`collectedCard` 存在 | `bg-white text-slate-950` + `BadgeCheck` | 「已收藏 {卡名}」/「补抽装饰卡」 | 禁用（`Boolean(collectedCard)`） | 「已收藏 {卡名}」 |

> 注意 `locked` 进度条用 `bg-slate-300` 且宽度 `Math.max(0, …)`（locked 时为 0），不要给 locked 卡硬塞 8% 最小宽度（现有逻辑已区分 `quest.status === "locked" ? 0 : 8`，保留）。
> `watch` 与 `locked` 在「需观察」筛选里合并（`filter === "watch"` 含两者）——保持。

#### 5.2 权益中心状态（`StudentBenefitStatus`）

`benefitStatusLabel`（已存在，中文齐全）：`available→可开始`、`in_progress→进行中`、`locked→待解锁`、`claimed→已点亮`。locked 进度条宽度 0（`item.status === "locked" ? 0 : 8`，保留）。

#### 5.3 加载 / 骨架

任务中心是 SSR（`StudentQuestDashboard` 收 `payload` props），首屏无前端 loading。需要骨架的两处：
- **路由级**：在 `src/app/(platform)/student/quests/` 加 `loading.tsx`，输出与最终布局同骨架（深色英雄条 + 三 KPI 卡 + 盲盒栏占位），用 `animate-pulse` 的 `bg-slate-100`/`bg-white/[0.07]` 块。reduce-motion 下 `animate-pulse` 要停（用 `motion-safe:animate-pulse`）。
- **抽卡/领取异步**：原地态，不整页骨架。按钮 `Loader2 animate-spin`（已有）+ `aria-busy` + 文案「抽卡中…」。

骨架无障碍：骨架根容器 `aria-hidden="true"` + 旁路一个视觉隐藏的 `<p className="sr-only" role="status">任务中心加载中…</p>`。

#### 5.4 空态

| 空场景 | 现状 | 文案（保留/微调） |
| --- | --- | --- |
| 卡库为空 | `QuestCardCollection` 已有虚线卡 | 标题「还没有收藏卡片」副「完成任务后点击"领取并抽卡"，第一张装饰卡就会加入这里。」 |
| 当前筛选无任务 | 已有 | 「该分类暂时没有任务，去完成更多沙盘动作来解锁吧。」 |
| 队列只剩选中卡 | 已有 `queuedVisibleQuests.length===0` 分支 | 「当前筛选下只有这个任务。切换上方分类可以查看其他盲盒。」 |
| 成就墙全未解锁 | 逐条渲染「待解锁」徽章，**非真空态** | 顶部补一句引导「先完成基础任务点亮第一枚成就。」 |

空态容器加 `role="status"`，让筛选切到空时读屏播报。

#### 5.5 错误态

| 错误源 | API 返回（`{error, message}`，`api-response.ts`） | 前端呈现 |
| --- | --- | --- |
| 领取失败 | `invalid_input/forbidden/db_unavailable` | `claimError` → `role="alert" bg-error-soft text-error`（已有）|
| 抽卡失败 | 同上 + `service_unavailable`(429 限流) | `drawError` → `role="alert"`（已有）|
| 限流（draw 20次/60s、claim 路由各自限流） | 429 `service_unavailable` + `buildRateLimitMessage` | 直接展示 message（中文「操作过于频繁，请 N 秒后再试」）|
| 卡配置失效 | `invalid_input`「这张卡片配置已更新，请联系管理员刷新卡库。」 | 透传 message |
| 任务未完成却点抽卡 | `forbidden`「这个任务还没有完成，暂时不能抽取装饰卡。」 | 透传 |

错误文案统一走 `data.message`（已实现），前端兜底中文「…请稍后再试」（已实现）。**错误必须可清除**：用户重试成功后 `setClaimError("")`/`setDrawError("")`（`claimQuest`/`drawQuestCard` 开头已清，保留）。

#### 5.6 离线 / 网络失败

- `fetch` 抛网络错（`TypeError: Failed to fetch`）落入 `catch`，当前会显示通用 `error.message`（英文）。**改为离线友好中文兜底**：在 catch 里判 `navigator.onLine === false` 或 `error instanceof TypeError`，覆盖为「网络连接中断，已为你保留进度，恢复网络后再试一次。」
- 离线检测横幅：监听 `window.addEventListener("offline"/"online")`，离线时在任务中心顶部插一条 `role="status"` 的 `bg-warning/10 text-warning` 条「当前处于离线状态，抽卡和领取将在恢复网络后可用。」并把所有领取/抽卡按钮 `disabled`。
- 因为卡库刷新后保留（DB 持久化，aside 文案「刷新页面后，已经抽到的卡也会继续保留」），离线时已收藏卡仍可见——空态/已收藏态不受影响。

---

### 6. 简体中文文案（微文案样例）

> 全部 user-facing，简体中文，符合 AGENTS.md「简洁中文 + 教育护栏」。下表为新增/统一项；已存在且达标的保留。

#### 6.1 稀有度中文映射（新增，给读屏与弹窗用）

```ts
const rarityZh: Record<QuestCardRarity, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
};
```

视觉徽章可保留英文 `COMMON/RARE/EPIC`（潮玩调性），但**读屏名与中文正文用普通/稀有/史诗**，并通过 `aria-label` 注入：`<span aria-label="史诗稀有度">EPIC</span>`。

#### 6.2 状态与按钮微文案

| key | 文案 |
| --- | --- |
| 翻卡按钮·未翻 | `拆开任务盲盒`（aria-label：`拆开任务盲盒，查看任务目标`）|
| 翻卡按钮·已翻 | `返回任务`（aria-label：`返回任务盲盒正面`）|
| 领取主按钮·可领 | `领取并抽卡` |
| 领取主按钮·进行中 | `抽卡中…` |
| 领取主按钮·已收藏 | `已收藏 {卡名}` |
| 领取主按钮·补抽 | `补抽装饰卡` |
| 领取主按钮·未完成 | `完成后可抽卡` |
| 抽卡揭示·读屏 | `抽卡揭晓：你抽到了「{卡名}」（{普通/稀有/史诗}）。这张卡已加入"我的卡库"，只做装饰与复盘记录，不改变战力或净值。` |
| 获得弹窗·标题 | `恭喜获得：{卡名}` |
| 获得弹窗·副 | `稀有度：{普通/稀有/史诗}` |
| 获得弹窗·CTA | `收下卡片` |
| 获得弹窗·护栏 | `卡片只记录学习与复盘轨迹，不增加战力，也不改变净值。` |
| 详情框·关闭 aria | `关闭任务详情` |
| 离线横幅 | `当前处于离线状态，抽卡和领取将在恢复网络后可用。` |
| 网络失败兜底 | `网络连接中断，已为你保留进度，恢复网络后再试一次。` |
| 限流 | （由后端 `buildRateLimitMessage` 提供，形如「操作太频繁，请稍后再试」，前端透传）|
| 加载（sr-only） | `任务中心加载中，请稍候。` |
| 卡库空态 | 标题 `还没有收藏卡片` / 副 `完成任务后点击"领取并抽卡"，第一张装饰卡就会加入这里。` |
| 成就·已点亮 / 待解锁 | `已点亮` / `待解锁`（保留）|

> 标点：用中文全角引号「」与（）。AGENTS.md 有「恢复沙盘 prompt 中文弯引号」的先例，本屏文案统一全角。

---

### 7. 验收清单（可落到测试）

- [ ] `npx tsc --noEmit` / `npm run lint` 绿。
- [ ] vitest-axe：对 `StudentQuestDashboard`（含翻面后状态、详情框打开态、获得弹窗打开态）跑 `axe`，0 violations，重点 `color-contrast`、`aria-hidden-focus`、`label`、`aria-dialog-name`。
- [ ] Playwright（`tests/e2e/student-internal-test.spec.ts`）：
  - 翻卡后 `quest-card-front-*` 整树 `inert`，焦点在背面首个交互元素；翻回焦点回到 `quest-flip-*`。
  - 详情框：ESC 关闭、Tab 在框内循环、关闭后焦点返回触发按钮。
  - 获得弹窗：出现即聚焦「收下卡片」，ESC/遮罩关闭并返回焦点。
  - `quest-draw-result` 为常驻 `role="status"` 容器，抽卡后含中文稀有度。
- [ ] 手动：系统开启「减少动态效果」后，无任何 `repeat:-1` 循环动画、翻卡瞬时、骨架不脉动。
- [ ] 手动：离线（DevTools offline）→ 顶部离线横幅出现、领取/抽卡按钮禁用、卡库仍可见。
- [ ] 对比度抽查：每个新「色彩身份卡」海报实色上的文字用 §1.2 安全底色或深墨字，实测 ≥4.5:1（大字 ≥3:1）。

---

**关键文件路径（绝对）**：
- 组件：`D:\树德实验中学（清波）\C2\brown-zone-web\src\components\student\student-quest-dashboard.tsx`
- 任务类型与构建：`D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\quests.ts`
- 卡牌/稀有度：`D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\cards.ts`
- 动效令牌：`D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\motion-system.ts`
- 设计令牌（amber-800/down-700/up-600 等）：`D:\树德实验中学（清波）\C2\brown-zone-web\src\app\globals.css`
- 抽卡 API（错误/限流/幂等契约）：`D:\树德实验中学（清波）\C2\brown-zone-web\src\app\api\student\quests\draw\route.ts`
- 建议新增：`D:\树德实验中学（清波）\C2\brown-zone-web\src\app\(platform)\student\quests\loading.tsx`（骨架）+ 共用 `useFocusTrap` hook（详情框与获得弹窗复用）。