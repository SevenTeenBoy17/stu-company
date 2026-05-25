# Brown Zone Design Tokens v1

> **唯一真相来源**：所有 UI 实现都必须读这份文件，禁止散落的硬编码颜色 / 字号 / 间距。  
> 本文档对应的 CSS 落地版本在 `src/app/globals.css` 的 `@theme inline` 块。

## 1. 设计理念

1. **教育温度优先**：色调偏暖（琥珀主色），避免冷峻金融感。
2. **中文为母语**：字体先选中文匹配，再考虑拉丁字符。
3. **金融语义本土化**：红 = 涨，绿 = 跌（A 股惯例，与西方反向）。
4. **三层 token**：primitive（色阶原料）→ semantic（按用途命名）→ component（组件局部）。组件层只能引用 semantic 层，不能引用 primitive。

---

## 2. Color — Primitive Scale

```css
/* === Brand 琥珀（教育温度）=== */
--amber-50:  #fff8ee;
--amber-100: #ffeacc;
--amber-200: #ffd49a;
--amber-300: #ffb967;
--amber-400: #ff9c3d;
--amber-500: #f08a38;  /* 现有 brand，保留 */
--amber-600: #d96f1d;
--amber-700: #b85715;
--amber-800: #944314;
--amber-900: #783814;

/* === Ink 深靛灰（理性 / 信赖）=== */
--ink-50:    #f7f9fc;
--ink-100:   #eef2f8;
--ink-200:   #dbe2ee;
--ink-300:   #bcc7d9;
--ink-400:   #8a99b3;
--ink-500:   #63708a;   /* 现有 muted */
--ink-600:   #475571;
--ink-700:   #303d56;
--ink-800:   #1f2638;   /* 现有 brand-ink */
--ink-900:   #101726;   /* 现有 foreground */

/* === Up 涨红 (A 股语义) === */
--up-50:     #fff1f0;
--up-100:    #ffe1dd;
--up-200:    #ffbab2;
--up-300:    #ff8a7d;
--up-400:    #ff5947;
--up-500:    #e8412e;   /* 主涨色 */
--up-600:    #c52e1c;
--up-700:    #9d2415;

/* === Down 跌绿 (A 股语义) === */
--down-50:   #ecfdf5;
--down-100:  #cef7df;
--down-200:  #9aedb8;
--down-300:  #5ddc8e;
--down-400:  #2ec468;
--down-500:  #16a14e;   /* 主跌色 */
--down-600:  #138142;
--down-700:  #126538;

/* === Info 蓝 (告知 / 链接) === */
--info-50:   #eff6ff;
--info-100:  #dbeafe;
--info-400:  #60a5fa;
--info-500:  #2563eb;
--info-600:  #1d4ed8;

/* === Warning 黄 (提醒 / 待观察) === */
--warning-50:  #fffbeb;
--warning-100: #fef3c7;
--warning-400: #facc15;
--warning-500: #eab308;
--warning-600: #ca8a04;

/* === Error 玫红 (危险 / 失败, 与涨红区分) === */
--error-50:  #fdf2f8;
--error-100: #fce7f3;
--error-400: #f472b6;
--error-500: #d12d50;
--error-600: #be185d;
```

## 3. Color — Semantic Layer

```css
/* 背景 */
--color-bg-app:        var(--ink-50);          /* 整页底色 */
--color-bg-surface:    #ffffff;                /* 卡片 */
--color-bg-elevated:   #ffffff;                /* 浮层、modal */
--color-bg-muted:      var(--ink-100);         /* 弱底（输入框、tag）*/
--color-bg-inverse:    var(--ink-900);         /* 反相（页脚、深底 hero）*/

/* 前景文字 */
--color-fg-default:    var(--ink-900);
--color-fg-strong:     var(--ink-800);
--color-fg-muted:      var(--ink-500);
--color-fg-subtle:     var(--ink-400);
--color-fg-inverse:    #ffffff;
--color-fg-link:       var(--info-600);

/* 品牌 */
--color-brand:         var(--amber-500);
--color-brand-hover:   var(--amber-600);
--color-brand-soft:    var(--amber-100);
--color-brand-on:      #ffffff;

/* 金融语义（关键！）*/
--color-up:            var(--up-500);
--color-up-soft:       var(--up-50);
--color-down:          var(--down-500);
--color-down-soft:     var(--down-50);
--color-neutral:       var(--ink-500);

/* 状态 */
--color-success:       var(--down-500);   /* 注意：success 借用跌绿，避免双绿 */
--color-warning:       var(--warning-500);
--color-error:         var(--error-500);
--color-info:          var(--info-500);

/* 边框 */
--color-border:        rgba(16, 23, 38, 0.10);
--color-border-strong: rgba(16, 23, 38, 0.18);
--color-border-brand:  var(--amber-300);

/* 焦点环 */
--color-ring:          rgba(240, 138, 56, 0.45);
```

---

## 4. Typography

### 4.1 字族

```css
/* 中文优先，英文次序：sans-cn → sans-latin → 系统兜底 */
--font-sans:    "Noto Sans SC", "Inter", "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif;
--font-display: "Noto Serif SC", "Inter", "Source Han Serif SC", "Songti SC", serif;
--font-mono:    "JetBrains Mono", "Fira Code", "Cascadia Mono", "Consolas", monospace;
```

加载方式：通过 `next/font/google` 在 `src/app/layout.tsx` 引入，仅取需要的 weights（节流首屏）：
- Noto Sans SC: 400, 500, 600
- Noto Serif SC: 500, 700（display 用）
- Inter: 400, 500, 600 + `variable` 支持 tabular-nums
- JetBrains Mono: 400, 500

### 4.2 Type Scale（9 档 + mono）

| token | font-size / line-height | letter-spacing | font-weight | 用途 |
|---|---|---|---|---|
| `text-display-2xl` | 64 / 72 | -0.02em | 700 | Hero 主视觉 |
| `text-display-xl` | 48 / 56 | -0.02em | 700 | 大标题 |
| `text-display-lg` | 40 / 48 | -0.015em | 600 | 章节大标 |
| `text-h1` | 32 / 40 | -0.01em | 600 | 页面 H1 |
| `text-h2` | 24 / 32 | -0.005em | 600 | 区块 H2 |
| `text-h3` | 20 / 28 | 0 | 600 | 卡片标题 |
| `text-body-lg` | 17 / 26 | 0 | 400 | 主流正文 |
| `text-body` | 15 / 24 | 0 | 400 | 标准正文 |
| `text-body-sm` | 13 / 20 | 0 | 400 | 辅助说明 |
| `text-caption` | 12 / 16 | 0.01em | 500 | 标签 / 元数据 |
| `text-mono` | 14 / 20 | 0 | 500 + tabular-nums | 金额、价格、百分比 |

CSS 落地（`@theme inline` 块新增）：
```css
--text-display-2xl: 4rem;
--text-display-2xl--line-height: 4.5rem;
--text-display-2xl--letter-spacing: -0.02em;
--text-display-2xl--font-weight: 700;
/* ...每档一组 ... */
```

### 4.3 中文排版铁律

- 中英混排：英文/数字两侧加 `0.125em` 空格（用 CSS `letter-spacing` 或手动写空格不强求，但 H1/H2 务必）
- 行距：中文正文不少于 `1.6`；display 级别 `1.1-1.15`
- 标点：避免行首孤标点，用 `text-wrap: pretty`（Next 16 兼容）
- 金融数字：永远 `font-variant-numeric: tabular-nums`，否则千分位会跳动

---

## 5. Spacing（4px 基线）

```
0    0px
0.5  2px
1    4px
1.5  6px
2    8px
2.5  10px
3    12px
4    16px
5    20px
6    24px
7    28px
8    32px
10   40px
12   48px
14   56px
16   64px
20   80px
24   96px
32   128px
```

Tailwind v4 自动按 `--spacing` 系数生成，无需手列。**禁止 arbitrary values 如 `p-[13px]`** — 不在尺度里就不存在。

### 5.1 Layout 间距规则

- 页面外边距：`safe-inline-offset`（已有），桌面 24px / 移动 12px
- Section 之间：`py-16 md:py-24`
- Section 内部子块：`gap-8 md:gap-12`
- 卡片内 padding：`p-5 md:p-6`（小卡）/ `p-6 md:p-8`（大卡）
- 卡片间隙：`gap-4 md:gap-6`
- 表单元素：`gap-3`，label 与 input 之间 `gap-1.5`

---

## 6. Radius

```css
--radius-none: 0px;
--radius-sm:   4px;
--radius-md:   8px;
--radius-lg:   12px;
--radius-xl:   16px;
--radius-2xl:  24px;
--radius-3xl:  32px;
--radius-full: 9999px;
```

用法约定：
- 按钮、tag、input：`--radius-lg`（12px）
- 卡片、面板：`--radius-2xl`（24px）
- 模态、抽屉：`--radius-2xl` 顶部
- 头像、徽章：`--radius-full`
- 大型 hero block：`--radius-3xl`

---

## 7. Shadow

```css
--shadow-sm:    0 1px 2px rgba(15, 23, 39, 0.05);
--shadow-md:    0 4px 12px rgba(15, 23, 39, 0.08);
--shadow-lg:    0 12px 32px rgba(15, 23, 39, 0.10);
--shadow-xl:    0 24px 64px rgba(15, 23, 39, 0.12);
--shadow-panel: 0 24px 70px rgba(15, 23, 39, 0.08);   /* 现有 .panel，保留 */
--shadow-glow:  0 0 32px rgba(240, 138, 56, 0.20);    /* brand 强调 */
--shadow-inner: inset 0 1px 2px rgba(15, 23, 39, 0.06);
```

用法：
- `shadow-md` 默认卡片
- `shadow-lg` 浮层、popover
- `shadow-xl` modal
- `shadow-panel` 主要内容大面板（最常用）
- `shadow-glow` 仅用于品牌强调元素（CTA、focus 高亮）

---

## 8. Motion

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-in:     cubic-bezier(0.7, 0, 0.84, 0);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

--duration-fast:   120ms;
--duration-base:   200ms;
--duration-slow:   320ms;
--duration-deep:   480ms;
```

Framer Motion 规约：
- 入场动画一律 `--ease-out` + `--duration-slow`
- 悬停态 `--ease-out` + `--duration-fast`
- 复杂转场（如 layout shift）`--ease-in-out` + `--duration-base`
- 必须读取 `prefers-reduced-motion`，命中时禁用所有 `y / scale / rotate`，只保留 `opacity`

---

## 9. Breakpoints

延用 Tailwind 默认：
- `sm`  640px — 小手机横屏 / 大手机竖屏
- `md`  768px — 平板竖屏
- `lg`  1024px — 平板横屏 / 小笔记本
- `xl`  1280px — 标准桌面
- `2xl` 1536px — 大屏

最小起点：iPhone SE 375px（不再支持 320px）。

---

## 10. Z-Index Scale

```css
--z-base:     0;
--z-raised:   10;
--z-dropdown: 20;
--z-sticky:   30;
--z-overlay:  40;
--z-modal:    50;
--z-popover:  60;
--z-toast:    70;
--z-tooltip:  80;
--z-floating: 90;  /* AI 悬浮按钮 */
```

---

## 11. 完整 globals.css `@theme inline` 替换块（直接复制）

```css
@theme inline {
  /* === Colors === */
  --color-bg-app: var(--ink-50);
  --color-bg-surface: #ffffff;
  --color-bg-elevated: #ffffff;
  --color-bg-muted: var(--ink-100);
  --color-bg-inverse: var(--ink-900);

  --color-fg-default: var(--ink-900);
  --color-fg-strong: var(--ink-800);
  --color-fg-muted: var(--ink-500);
  --color-fg-subtle: var(--ink-400);
  --color-fg-inverse: #ffffff;
  --color-fg-link: var(--info-600);

  --color-brand: var(--amber-500);
  --color-brand-hover: var(--amber-600);
  --color-brand-soft: var(--amber-100);
  --color-brand-on: #ffffff;

  --color-up: var(--up-500);
  --color-up-soft: var(--up-50);
  --color-down: var(--down-500);
  --color-down-soft: var(--down-50);
  --color-neutral: var(--ink-500);

  --color-success: var(--down-500);
  --color-warning: var(--warning-500);
  --color-error: var(--error-500);
  --color-info: var(--info-500);

  --color-border: rgba(16, 23, 38, 0.10);
  --color-border-strong: rgba(16, 23, 38, 0.18);
  --color-border-brand: var(--amber-300);
  --color-ring: rgba(240, 138, 56, 0.45);

  /* === Fonts === */
  --font-sans: "Noto Sans SC", "Inter", "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif;
  --font-display: "Noto Serif SC", "Inter", "Source Han Serif SC", "Songti SC", serif;
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Mono", "Consolas", monospace;

  /* === Type Scale === */
  --text-display-2xl: 4rem;
  --text-display-2xl--line-height: 4.5rem;
  --text-display-2xl--letter-spacing: -0.02em;
  --text-display-2xl--font-weight: 700;

  --text-display-xl: 3rem;
  --text-display-xl--line-height: 3.5rem;
  --text-display-xl--letter-spacing: -0.02em;
  --text-display-xl--font-weight: 700;

  --text-display-lg: 2.5rem;
  --text-display-lg--line-height: 3rem;
  --text-display-lg--letter-spacing: -0.015em;
  --text-display-lg--font-weight: 600;

  --text-h1: 2rem;
  --text-h1--line-height: 2.5rem;
  --text-h1--letter-spacing: -0.01em;
  --text-h1--font-weight: 600;

  --text-h2: 1.5rem;
  --text-h2--line-height: 2rem;
  --text-h2--letter-spacing: -0.005em;
  --text-h2--font-weight: 600;

  --text-h3: 1.25rem;
  --text-h3--line-height: 1.75rem;
  --text-h3--font-weight: 600;

  --text-body-lg: 1.0625rem;
  --text-body-lg--line-height: 1.625rem;

  --text-body: 0.9375rem;
  --text-body--line-height: 1.5rem;

  --text-body-sm: 0.8125rem;
  --text-body-sm--line-height: 1.25rem;

  --text-caption: 0.75rem;
  --text-caption--line-height: 1rem;
  --text-caption--letter-spacing: 0.01em;
  --text-caption--font-weight: 500;

  /* === Radius === */
  --radius-none: 0px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-3xl: 32px;
  --radius-full: 9999px;

  /* === Shadow === */
  --shadow-sm: 0 1px 2px rgba(15, 23, 39, 0.05);
  --shadow-md: 0 4px 12px rgba(15, 23, 39, 0.08);
  --shadow-lg: 0 12px 32px rgba(15, 23, 39, 0.10);
  --shadow-xl: 0 24px 64px rgba(15, 23, 39, 0.12);
  --shadow-panel: 0 24px 70px rgba(15, 23, 39, 0.08);
  --shadow-glow: 0 0 32px rgba(240, 138, 56, 0.20);
  --shadow-inner: inset 0 1px 2px rgba(15, 23, 39, 0.06);
}
```

---

## 12. Migration Checklist for ui_implementer

落地时按顺序：
1. 在 `:root` 块下补齐 §2 所有 primitive 变量（如 --amber-50 等当前没有）
2. 用 §11 整块替换现有 `@theme inline`
3. 全仓 grep `#[0-9a-fA-F]{3,8}`，把硬编码替换为 token
4. 全仓 grep `text-\\[|p-\\[|w-\\[` arbitrary values，替换为尺度内值
5. 在 `layout.tsx` 用 `next/font/google` 加载 Noto Sans SC / Noto Serif SC / Inter / JetBrains Mono
6. 跑 `npm run build` 确认 Tailwind v4 把新 token 编译进 CSS
