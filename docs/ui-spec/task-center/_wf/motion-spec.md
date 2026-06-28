## 任务中心 动效规范（GSAP Motion Spec）

实现基座：所有动效都通过 `@gsap/react` 的 `useGSAP(() => …, { scope: rootRef })` 注册，事件型动画一律用解构出的 `contextSafe()` 包裹（与当前 `animateQuestCard` / `toggleQuestFlip` 一致）。新增动效**只写 `transform` / `opacity`（含 `autoAlpha`）**，禁止动 `width/height/top/left/box-shadow/filter`。运动曲线优先复用 `premiumMotion.ease.*` 与 `premiumMotion.duration.*`（`src/lib/motion-system.ts`），不要散落魔法数。

### 0. 全局约束与现状对齐

| 约束 | 来源 | 规则 |
| --- | --- | --- |
| 稀有度只有三档 | `QuestCardRarity = "common" \| "rare" \| "epic"`（`src/lib/cards.ts`） | 文中“legendary”一律映射为 **epic** 顶配。升级幅度按 `common → rare → epic` 三级递增，预留第四档需先扩 `cards.ts` 枚举与权重。 |
| 减弱动效 | `globals.css` 已有全局 `@media (prefers-reduced-motion: reduce)` 复位 | CSS 复位只兜 transition/animation；**GSAP 补间不受 CSS media query 约束**，每个 JS 动效必须自带 `window.matchMedia("(prefers-reduced-motion: reduce)").matches` 分支（沿用 `useGSAP` 里现有写法）。 |
| will-change 纪律 | `globals.css` 注释 `ANIM-JANK-2` | 不在节点上挂常驻 `will-change`。仅“持续循环”动效（foil shimmer / 庆祝光带）在 `onStart` 设、`onComplete`/`kill` 清。一次性补间不设。 |
| a11y 翻卡 | 现有 `aria-hidden={isFlipped}` + `inert={isFlipped}` 双面互斥 | 动效不得接管这两个属性的真值来源。React state `flippedQuestIds` 仍是唯一事实源；GSAP 只负责 `rotateY` 视觉，**`setFlippedQuestIds` 必须先于补间调用**（现状已如此）。 |
| 清理 | `useGSAP` scope=`rootRef` | scope 内创建的补间/timeline 在组件卸载和依赖变更时由 `useGSAP` 自动 revert。`contextSafe` 之外（如 `setTimeout`、第三方监听）创建的补间必须手动 `.kill()`。 |

建议在 `motion-system.ts` 的 `premiumMotion` 上补三个常量（供下文引用，纯数据、零副作用）：

```ts
// premiumMotion 内追加
rarity: {
  common:    { tilt: 4,  glow: 0,    confetti: 0,  shimmer: false, burstScale: 1.0 },
  rare:      { tilt: 7,  glow: 0.35, confetti: 14, shimmer: true,  burstScale: 1.06 },
  epic:      { tilt: 10, glow: 0.6,  confetti: 26, shimmer: true,  burstScale: 1.12 },
} as const,
```

并加一个共享的减弱判定，避免每处重复字符串：

```ts
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

---

### 1. 翻卡：任务正面 → 奖励背面（已存在，规范化）

承接现有 `animateQuestCard(questId, nextFlipped)`。目标节点是 `[data-quest-card-inner="<questId>"]`（外层 `article` 已有 `[perspective:1200px]`，内层 `transformStyle: preserve-3d`，两面各 `backfaceVisibility: hidden` 且背面 `transform: rotateY(180deg)`）。

| 维度 | 值 |
| --- | --- |
| 触发 | 点击 `[data-testid="quest-flip-<id>"]`（拆盒）/ 背面“返回任务”按钮 → `toggleQuestFlip` |
| target | `rootRef.current.querySelector('[data-quest-card-inner="…"]')`（**逐节点 query，禁止字符串选择器全量匹配**——队列里可能渲染多张同结构卡） |
| 属性 | `rotateY: nextFlipped ? 180 : 0`，`transformPerspective: 900` |
| duration / ease | `premiumMotion.duration.reward`(0.66s) / `premiumMotion.ease.reward`(`back.out(1.6)`)——保持现状 |
| reduced-motion | `gsap.set(card, { rotateY: target, transformPerspective: 900 })` 瞬切（现状已实现） |
| a11y | state 先行翻转 → `aria-hidden`/`inert` 立即生效；背面里的“查看任务详情/领取并抽卡”在翻面瞬间即可聚焦，无需等补间结束（现有 E2E `await flip-revealed quest detail controls` 已守这点，勿回退） |
| 性能 | 翻卡是一次性补间，**不设常驻 will-change**；`back.out(1.6)` 的回弹保持在 ±0.5° 内，避免文字在回弹尾段出现亚像素抖动 |

> 精修建议（不改触发链）：在 `gsap.to` 上加 `onStart: () => gsap.set(card, { willChange: "transform" })`、`onComplete: () => gsap.set(card, { willChange: "auto" })`，把合成层只在翻转那 0.66s 存在。

---

### 2. 抽卡揭晓序列（draw-reveal）

承接 `drawQuestCard` → 成功后现状只做 `animateQuestCard(questId, true)` 并把卡塞进 `[data-testid="quest-drawn-card-<id>"]`（背面内嵌的 `QuestCardArt compact`）。新增一段**入场 timeline**，让“新卡”有“从盒中升起 + 落定”的获得感。给该容器加 `data-draw-reveal` 标记。

序列（一条 `gsap.timeline`，在 `addCollectionItem` 之后、`setDrawResult` 同帧用 `requestAnimationFrame` 触发，确保节点已挂载）：

| 步骤 | target | from → to | dur / ease |
| --- | --- | --- | --- |
| ① 升起 | `[data-draw-reveal="<id>"]` | `autoAlpha:0, y:24, scale:0.9` → `autoAlpha:1, y:0, scale:1` | `premiumMotion.duration.draw`×0.6 / `power3.out` |
| ② 落定回弹 | 同上 | `scale:1` → `scale: rarity.burstScale → 1`（`yoyo` 单程） | 0.32s / `back.out(2)` |
| ③ 稀有度收尾 | 见 §5 | rare/epic 追加 glow 脉冲或 foil（`<<` 与②并行） | — |
| ④ 文案计数 | `[data-testid="quest-draw-result"]` 内“X 张已收藏” | 见 §8 count-up | `premiumMotion.duration.number` |

- 触发：`drawQuestCard` 成功分支（`item` 就绪后）。复抽命中 `collectionByQuestId` 已有卡时**跳过 ①②**，只翻面（现状逻辑保留），避免重复奖励演出诱导“刷抽”。
- reduced-motion：整条 timeline 用 `gsap.set([...], { autoAlpha:1, y:0, scale:1 })` 一帧到位，**不放 confetti、不放 shimmer**。
- 性能：timeline 结束 `onComplete` 里 `tl.kill()` 并清 `will-change`；confetti 节点（§5）演出完即从 DOM 移除或 `display:none`，不残留。
- 教育约束：抽卡演出强度**只与稀有度挂钩，不与“连续抽中/未中”挂钩**；没有“差一点中”动画、没有失败抖动，杜绝损失追逐式 gacha 反馈。

---

### 3. 吉祥物获得 庆祝弹窗（celebration modal）

参考图 4 的“editorial poster + MY TURN”气质。这是一个新模态（建议 `QuestRewardCelebrationModal`，由 `claimQuest` 成功后置 `claimResult`/`drawResult` 时挂载，`role="dialog" aria-modal="true"`，复用 `QuestDetailDialog` 的遮罩结构）。根容器 `data-motion-modal`，遮罩 `data-motion-overlay`，海报卡 `data-reward-poster`，光带 `data-reward-rays`，箔面 `data-reward-foil`，粒子层 `data-reward-burst`。

入场 timeline（`contextSafe`，scope=rootRef）：

| 序 | target | from → to | dur / ease | 备注 |
| --- | --- | --- | --- | --- |
| 1 | `[data-motion-overlay]` | `autoAlpha:0` → `autoAlpha:1` | 0.24s / `power2.out` | 背景 dim；只动 opacity |
| 2 | `[data-reward-poster]` | `autoAlpha:0, scale:0.82, y:16` → `scale:1, y:0` | `premiumMotion.duration.scene`(0.74s) / `elastic.out(1, 0.62)` | **过冲回弹** = 开箱手感；epic 用 `elastic.out(1, 0.55)`（弹更久） |
| 3 | `[data-reward-rays]` | `rotate:0, scale:0.6, autoAlpha:0` → `rotate:18, scale:1.25, autoAlpha:0.0` | 0.9s / `sine.out` | 径向光带**扫一遍**：opacity `0→peak→0`（rare 0.18 / epic 0.32 峰值，common 跳过），`transform-origin:center` |
| 4 | 角色名（大字 display） | `autoAlpha:0, y:14` → `autoAlpha:1, y:0` | 0.5s / `power3.out`，`position:"-=0.4"` | 与海报回弹尾段叠帧 |
| 5 | tagline + CTA「去练习」 | `autoAlpha:0, y:10` → `autoAlpha:1, y:0`，`stagger:0.06` | 0.42s / `power2.out` | |
| 6 | `[data-reward-burst]` 粒子 | 见 §5 confetti burst（仅 rare+） | — | 与步骤 2 回弹峰值同帧 |

退场：`autoAlpha → 0` + `scale 1 → 0.96`，0.2s `power2.in`，`onComplete` 卸载并 `tl.kill()`。

焦点与 a11y：
- 打开时把焦点移到关闭按钮（`useGSAP` 之外，用一个 `useEffect` + `ref.focus()`，不要靠动效）。`Esc` 关闭。遮罩点击关闭。
- 文字内容（角色名/教学 tagline）**不可只靠动画呈现**：即使 reduced-motion / 动画被跳过，DOM 文本已在；动效仅装饰。
- 给整段演出加 `aria-live="polite"` 的 `role="status"`（复用现有 `quest-claim-result`/`quest-draw-result` 模式）播报“已获得 {card.name}（{稀有度}）”。

reduced-motion：`gsap.set([overlay, poster, name, cta], { autoAlpha:1, scale:1, y:0 })`，**不渲染光带、不渲染粒子**。模态直接呈现完成态。

教学边界文案（弹窗内固定显示，不随动画变）：「奖励仅作装饰与复盘记录，不改变净值、战力或排行榜。」——与现有 `QuestCardCollection` 文案一致。

---

### 4. 卡片悬停 微倾斜 / 视差（hover micro-tilt）

作用于盲盒正面 `[data-testid="quest-card-front-<id>"]` 与卡库 `[data-testid^="collection-card-"]`（均已带 `data-motion-card`）。**仅指针设备**：用 `window.matchMedia("(hover: hover) and (pointer: fine)").matches` 守卫，触屏不挂监听。

| 维度 | 值 |
| --- | --- |
| 触发 | `pointermove`（节流到 rAF）/ `pointerenter` / `pointerleave`，在 `useGSAP` 内用 `contextSafe` 绑定，监听器在 cleanup 里移除 |
| target | 卡片元素本身（倾斜）+ 内部 `QuestBlindBoxArt` 的角色块 `[data-tilt-layer]`（视差，位移更大造成纵深） |
| 属性 | 卡片：`rotateX`/`rotateY = ±rarity.tilt`（common 4° / rare 7° / epic 10°），`transformPerspective:900`；角色层：`x/y` 反向位移 ≤ 8px |
| ease / dur | 跟手用 `gsap.quickTo(el, "rotateY", { duration: premiumMotion.duration.hoverIn(0.3), ease: "power3.out" })`（`quickTo` 复用同一补间，零 GC、零 layout thrash） |
| leave 回中 | `rotateX/Y → 0`，`premiumMotion.duration.hoverOut`(0.44s) `power2.out` |
| reduced-motion / 无 hover | 完全不绑定监听；保留现有 CSS `hover:-translate-y-0.5/-1`（纯 transform，安全） |
| 性能 | `pointermove` 必须 `gsap.ticker`/rAF 节流，回调内只读 `getBoundingClientRect` **一次/enter**（缓存尺寸），move 内不再读布局；`will-change` 仅在 `pointerenter` 设、`pointerleave` 清 |

> 反例守门：不要在 `pointermove` 回调里 `querySelector` 或读 `offsetWidth`——那是典型 layout thrash。enter 时缓存 rect，move 只做数学。

---

### 5. 稀有度阶梯特效（common 收敛 → epic 戏剧）

统一入口：一个纯函数 `rewardTier(rarity)` 返回 §0 的 `premiumMotion.rarity[rarity]`，所有演出读它做条件分支，**绝不为某稀有度写独立 timeline**——保证可维护与一致节奏。

| 效果 | common | rare | epic |
| --- | --- | --- | --- |
| 落定回弹 `burstScale` | 1.0（无回弹，仅淡入） | 1.06 | 1.12 |
| 边框/卡面 glow 脉冲 | 无 | `autoAlpha` 脉冲一次（叠加在已有 `shadow-glow` 类上的伪元素 `data-glow-pulse`，动 opacity 0→0.35→0） | 同 rare 但峰值 0.6，脉冲 2 次 |
| 径向光带 `data-reward-rays` | 跳过 | 扫 1 遍，峰值 0.18 | 扫 1 遍，峰值 0.32，`scale` 更大 |
| 箔面 foil shimmer | 无 | 有（§6） | 有，速度略快 |
| 粒子 burst `data-reward-burst` | 0 颗 | 14 颗 | 26 颗 |

**粒子 burst 实现（仅 rare+，零库依赖，纯 transform）**：在 `data-reward-burst` 容器内 JS 生成 N 个绝对定位小 `span`（品牌色 `--brand` / `--brand-warm` / `--up` 红，**回避 `--down` 绿以免误读为亏损**）。每颗：

```
from { x:0, y:0, scale:0, autoAlpha:1 }
to   { x: cos(θ)*R, y: sin(θ)*R, scale: rand(0.6,1.1), autoAlpha:0,
       rotate: rand(-90,90), duration: 0.7~0.95, ease: "power2.out" }
```

θ 均匀分布、R=120~180px。`onComplete` 整体移除 DOM 节点。**绝不无限循环**（无 `repeat:-1`），演出一次即止——这是“庆祝”，不是“持续诱导”。

reduced-motion：所有 glow/光带/foil/粒子整条跳过，只保留 §3 的瞬时呈现。

---

### 6. 箔面微光（foil shimmer，rare+ 常驻循环）

仅 rare/epic 卡的稀有度色带或卡面顶层叠一条 `data-reward-foil` 渐变高光（`linear-gradient` 斜向窄带），**这是唯一允许常驻循环的卡内动效**。

| 维度 | 值 |
| --- | --- |
| 触发 | 卡进入视口后启动（`ScrollTrigger`/`IntersectionObserver` 二选一；项目已有视口揭示模式，复用即可） |
| 属性 | `xPercent: -120 → 120`（高光带横扫），容器 `overflow:hidden` 裁切 |
| dur / ease / repeat | 2.4s / `sine.inOut` / `repeat:-1, repeatDelay: 3`（epic `repeatDelay:2`，稍勤） |
| will-change | `onStart` 设 `will-change:transform`，`kill` 时清——这是 `ANIM-JANK-2` 注释里明确允许“持续循环”挂 will-change 的场景 |
| reduced-motion | 不创建该 timeline；箔面以静态高光呈现（CSS 渐变即可） |
| 性能 | 离开视口时 `tl.pause()`，节省非可见区合成；卡库可能 4 列多张，务必只对 rare+ 启动，common 不挂 |

---

### 7. 收藏网格 错峰入场（grid stagger）

承接现有 `useGSAP` 里 `[data-quest-reveal]`（区块级，0.62s `power3.out` stagger 0.055）与 `[data-calendar-cell]`（0.5s `back.out(1.4)` stagger 0.025）。**新增卡库内卡片级 stagger**——当前 `QuestCardCollection` 的 `[data-testid^="collection-card-"]` 只随区块整体淡入，缺逐卡节奏。

| 维度 | 值 |
| --- | --- |
| 触发 | 卡库区块进入视口（`ScrollTrigger` once，或挂在现有 reveal 之后） |
| target | `[data-testid^="collection-card-"]`（给它们补 `data-collection-card`） |
| from → to | `autoAlpha:0, y:18, scale:0.96` → `autoAlpha:1, y:0, scale:1` |
| dur / ease | `premiumMotion.duration.cardReveal`(0.6s) / `power3.out` |
| stagger | `{ each: 0.05, from: "start", grid: "auto" }`（4 列时按网格对角扩散更生动） |
| clearProps | `"transform,opacity,visibility"`（与现有 reveal 一致，演出后交还 CSS，避免 inline transform 干扰 hover-tilt） |
| reduced-motion | `gsap.set(cards, { autoAlpha:1, clearProps:"transform,opacity,visibility" })` 一帧到位（沿用 `useGSAP` 顶部分支写法） |
| 性能 | stagger 入场是一次性，不挂 will-change；`once:true` 防回滚重播 |

> 注意叠加顺序：网格 stagger 的 `clearProps` 必须在 §4 hover-tilt 监听“可用之前”完成，否则 inline `transform` 会和 `quickTo` 打架。用 `onComplete` 标记 `cardsReady` 再允许 tilt（或 tilt 监听本就 `pointerenter` 才读取，天然晚于入场）。

---

### 8. 数字滚动（count-up）

用于：英雄区 `任务完成度 {completed}/{total}`（`text-hero-num`）、`净值连升`、`学习进度`、赛季 `{completedObjectives}/{totalObjectives} · {progress}%`、卡库 `{items.length} 张已收藏`。给这些数字节点加 `data-motion-number` + `data-count-to` + `data-count-format`（复用 `MotionNumberFormat` 与 `formatMotionNumber`，`motion-system.ts` 已导出）。

| 维度 | 值 |
| --- | --- |
| 触发 | 节点进入视口（once）；以及对应值因领取/抽卡变化时（`completed++`、卡库 `length++`）重跑 |
| target | `[data-motion-number]` 内文本 |
| 属性 | 补间一个代理对象 `{ v: from }`，`onUpdate` 写 `el.textContent = formatMotionNumber(obj.v, format)`——**不触发 layout**（`tabular-nums` 已保证字宽稳定，不会逐帧重排） |
| dur / ease | `premiumMotion.duration.number`(1.15s) / `power3.out` |
| 防抖 | 同节点重跑前 `gsap.killTweensOf(proxy)`，避免叠加补间数字跳变 |
| reduced-motion | 直接 `el.textContent = formatMotionNumber(to, format)`，无补间 |
| 性能 | 用 `snap: { v: 1 }`（整数）或 percent 用 0.1，避免 onUpdate 里再 `Math.round`；`tabular-nums` 是这条不抖动的前提（项目约定，已具备） |
| a11y | 给容器 `aria-label` 写最终值（如 `aria-label="任务完成度 7/12"`），屏读不读逐帧中间数 |

---

### 9. 实现骨架（贴合现有 `StudentQuestDashboard`）

把所有新增动效收进**同一个** `useGSAP(() => {...}, { scope: rootRef })`，与现有 reveal 共用一个 context（统一清理、统一 reduced-motion 分支）。事件型（翻卡、tilt、庆祝、抽卡）用 `contextSafe` 句柄，存在组件内供 onClick 调用——延续当前 `animateQuestCard`/`toggleQuestFlip` 的写法。

```tsx
const reduce = prefersReducedMotion(); // §0 共享判定

const { contextSafe } = useGSAP(() => {
  if (reduce) {
    gsap.set("[data-quest-reveal], [data-calendar-cell], [data-collection-card]",
      { autoAlpha: 1, clearProps: "transform,opacity,visibility" });
    gsap.set("[data-quest-card-inner]", { rotateY: 0, transformPerspective: 900 });
    // count-up 直接落终值；foil/rays/burst 全部不创建
    return;
  }
  // ① 区块 reveal（现状保留）
  // ② 日历 cell（现状保留）
  // ③ 卡库 stagger（§7）—— ScrollTrigger once
  // ④ count-up（§8）—— 进入视口跑一遍
  // ⑤ rare+ foil shimmer（§6）—— 仅对 [data-reward-foil] 启动
  // hover-tilt 监听仅在 matchMedia("(hover:hover)") 下绑定，cleanup 里 off
}, { scope: rootRef });

// 事件型 contextSafe 句柄（onClick 调用）
const animateQuestCard      = contextSafe(/* §1，现状 */);
const playDrawReveal        = contextSafe(/* §2 */);
const playRewardCelebration = contextSafe(/* §3 + §5 */);
```

**清理清单**（防泄漏）：
- scope 内 `gsap.to/timeline/quickTo` → `useGSAP` 自动 revert，无需手动。
- `pointermove`/`IntersectionObserver`/`gsap.ticker.add` → 在 `useGSAP` 返回的 cleanup 函数里 `removeEventListener` / `observer.disconnect()` / `gsap.ticker.remove()`。
- 庆祝/抽卡 timeline → `onComplete: () => tl.kill()`；动态生成的粒子节点 → 同 `onComplete` 移除 DOM。
- foil 循环 timeline → 离开视口 `pause()`，组件卸载随 context revert；其 `will-change` 在 `kill`/cleanup 显式还原 `auto`。

**杜绝 layout thrash 三条铁律**：(1) `pointermove` 只读缓存的 rect，不读实时 `offset*`；(2) count-up 只写 `textContent`，不写 `style.width`；(3) 所有补间属性限定在 `transform`/`opacity`，进度条/卡面尺寸变化交给现有 `data-motion-viz-bar`（`transform-origin:left center` 的 scaleX 模式，已在 DOM 标好 `data-motion-origin`）。

---

### 10. 节奏与“防成瘾”护栏（产品要求，硬约束）

| 规则 | 动效落点 |
| --- | --- |
| 演出强度只随**稀有度**升级，绝不随“连抽次数/连胜”升级 | §2/§3/§5 一律读 `rewardTier(rarity)`，无 streak 参数 |
| 无“差一点中奖”动画、无失败抖动/红光 | §2 复抽命中已有卡时跳过升起回弹；无 miss 状态机 |
| 庆祝弹窗常驻教学文案“仅装饰，不改净值/战力/排行” | §3 DOM 文本，动画不可隐藏它 |
| 颜色守红涨绿跌：粒子/光带用 `--brand`/`--brand-warm`/`--up`(红)，避开 `--down`(绿) | §5 粒子取色 |
| 全部动效在 reduced-motion 下有完整静态等价物 | 每节均列瞬时落终值分支 |

相关文件：`src/components/student/student-quest-dashboard.tsx`（动效宿主与所有 `data-*` 标记落点）、`src/lib/motion-system.ts`（`premiumMotion` 令牌，建议追加 `rarity`/`prefersReducedMotion`）、`src/lib/cards.ts`（`QuestCardRarity` 仅三档，是稀有度阶梯的事实源）、`src/app/globals.css`（`prefers-reduced-motion` 复位、`ANIM-JANK-2` will-change 纪律、`.grid-strokes`/`.quest-glass-scroll`）。