# Student Dashboard Spec — 学生策略台 v2

> 路由：`/student` · 文件：`src/app/(platform)/student/page.tsx` + `src/components/student/*`  
> 现状问题：信息密度合理但视觉层级弱，金额数字与正文同字号，操作面板与展示面板没有明显层次。  
> 目标：用 token 体系建立 3 层视觉层级（hero → 主体三栏 → 浮动操作），让学生 3 秒能抓到「我现在第几名 / 净值多少 / 风险高不高」。

---

## 1. 信息架构

```
┌───────────────────────────────────────────────────────────┐
│ Page Header（紧凑导航 + 用户切换器，桌面 64px / 移动 56px）│
├───────────────────────────────────────────────────────────┤
│                                                             │
│  HERO  ─── 当前回合 / 净值 / 排名 / 风险 / 纪律 五个核心指标 │
│         浅琥珀渐变底，display 字号                          │
│                                                             │
├───────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────────────────┐           │
│  │  策略行动     │  │   持仓 + 历史时间线        │           │
│  │  （左 1/3）   │  │   （右 2/3）              │           │
│  │              │  │                            │           │
│  │  Tab:        │  │   持仓表格（前 5 大）       │           │
│  │   交易        │  │   ────────────────         │           │
│  │   储蓄/贷款   │  │   最近 8 条操作            │           │
│  │   房产        │  │                            │           │
│  │   创业        │  │                            │           │
│  └──────────────┘  └──────────────────────────┘           │
│                                                             │
├───────────────────────────────────────────────────────────┤
│  Mr.Brown 导师板（雷达 + 文字反思 + 一键刷新）              │
├───────────────────────────────────────────────────────────┤
│  班级排行榜 Top 3 + 我的位置                                │
└───────────────────────────────────────────────────────────┘

[ 浮动 AI 助手按钮 — 右下，z-floating ]
```

---

## 2. HERO 区（最高优先级）

### 2.1 视觉规格

- 容器：`rounded-3xl shadow-panel bg-gradient-to-br from-amber-50 via-white to-ink-50 p-6 md:p-10 mt-6`
- 高度：自适应内容，桌面约 240px
- 装饰：右上角放一个低饱和的 `hero-stage-art` SVG（opacity 0.4），不抢主信息

### 2.2 五个指标卡（2 行布局，桌面 1 行）

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ 第 N 回合     │ 净值          │ 班级排名      │ 风险分        │ 纪律分        │
│ /12          │ ¥ 123,456    │ #2 / 36      │ 67 ↑         │ 84 →         │
│ display-lg   │ display-2xl  │ display-xl   │ display-lg   │ display-lg   │
│ font-display │ font-mono    │ font-display │ font-mono    │ font-mono    │
│ ink-700      │ amber-700    │ ink-800      │ up/down      │ ink-800      │
│              │ tabular-nums │              │ 语义色        │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

每个指标卡内部结构：
```tsx
<div className="flex flex-col gap-1.5">
  <span className="text-caption text-fg-muted uppercase tracking-wider">净值</span>
  <span className="text-display-2xl font-mono text-amber-700 tabular-nums">
    ¥{formatMoney(netWorth)}
  </span>
  <span className="text-body-sm text-fg-muted">
    <TrendArrow delta={delta} />  +¥{Math.abs(delta)}（比上回合）
  </span>
</div>
```

### 2.3 响应式

- `< sm`：5 卡片纵向堆叠，每张占整行
- `sm-md`：2-2-1 排（第三行单独"纪律分"居中）
- `md+`：3-2 排
- `lg+`：5 张一行

### 2.4 数字动画

净值数字在 props 变化时用 `motion.span` + `animate({ count: from → to })`，duration 480ms ease-out。不要用 setInterval 自己写。

---

## 3. 主体三栏（响应式重排）

### 3.1 桌面布局（lg+）

```
[Action Panel 1fr]  [Holdings + Timeline 2fr]
```

### 3.2 平板（md ~ lg）

两栏改成上下，Action Panel 在上（粘性顶部以便操作时仍可见）

### 3.3 移动（< md）

单列，Action Panel 收起为底部抽屉（保留现有的安全区适配）

### 3.4 Action Panel（左栏）

- 容器：`rounded-2xl shadow-md bg-bg-surface border border-border p-5 md:p-6 sticky top-20`
- Header：`text-h3 font-display` "策略行动"
- Tab：4 个，使用 amber-100 底高亮当前 tab
- Tab 内表单：
  - label `text-body-sm text-fg-muted`
  - input `rounded-lg border border-border h-11 px-3 text-body`
  - 主 CTA `bg-brand text-brand-on h-11 rounded-lg text-body font-medium shadow-md hover:bg-brand-hover`
  - 次要按钮 `bg-bg-muted text-fg-default h-11 rounded-lg border border-border`
- 表单错误：`text-error text-body-sm` 出现在 input 下

### 3.5 Holdings 卡（右栏上半）

- 容器：`rounded-2xl shadow-md bg-bg-surface p-5 md:p-6`
- Header：`text-h3` + 右侧 `text-caption` 显示总持仓市值
- 表格：5 列 — 资产名 / 持仓数 / 成本 / 现价 / 浮盈
  - 列宽：`grid-cols-[2fr,1fr,1fr,1fr,1fr]`
  - 数字列右对齐 + `font-mono tabular-nums`
  - 浮盈用 `text-up` / `text-down` 语义色
- 空状态：插画 + "尚未建仓，去左侧买入第一笔"

### 3.6 操作时间线（右栏下半）

- 列出最近 8 条 actionLog
- 每条：`flex items-start gap-3 py-3 border-t border-border first:border-t-0`
- 左侧 icon（lucide-react，根据 type）：
  - trade → `TrendingUp` / `TrendingDown`
  - bank → `PiggyBank` / `Landmark`
  - property → `Building2`
  - venture → `Rocket`
  - advance → `Forward`
- 文字：`text-body` label + `text-caption text-fg-muted` 时间
- 金额：右对齐 `font-mono`，正数 up 色，负数 down 色

---

## 4. Mr.Brown 导师板

- 容器：`rounded-2xl shadow-panel bg-gradient-to-r from-ink-50 to-amber-50 p-6 md:p-8`
- 布局：`grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6`
- 左：6 维雷达图（Recharts 或 D3，但优先用现有 student-tutor-radar 组件）
- 右：
  - 头部：`text-caption text-amber-700` "MR.BROWN 观察" + 右侧"一键刷新"按钮
  - 文字：`text-body-lg leading-relaxed text-fg-strong`
  - 三条建议：编号列表，每条 `text-body`

### 4.1 一键刷新交互

- 按钮：`size-9 rounded-full bg-brand-soft text-amber-700 hover:bg-amber-200`
- 点击 → POST `/api/ai/radar-chart` → 显示 `motion.div` skeleton 200ms → 平滑替换文字
- 失败 → 显示 toast，保留旧文字不闪烁

---

## 5. 排行榜区

- 3 张并排卡片（金 / 银 / 铜配色）
- 桌面：`grid-cols-3 gap-4`
- 移动：横向滚动 + scroll-snap
- 每卡：
  - 顶部勋章 icon
  - 名字 `text-h3`
  - 净值 `text-display-lg font-mono`
  - 学校 / 班级标签
- 当前用户的位置：用 amber 描边 + "ME" 标签

---

## 6. 微交互清单

| 元素 | 交互 | Token |
|---|---|---|
| 卡片 hover | `translate-y-[-2px]` + `shadow-lg` | `--duration-fast` + `--ease-out` |
| 数字变化 | count-up 动画 | `--duration-deep` + `--ease-out` |
| Tab 切换 | 内容淡入 + 18px y 轴入场 | `--duration-base` |
| 表单提交成功 | 按钮短暂变 success 色 + check icon | `--duration-base` |
| 错误 toast | 从顶部下滑 | `--duration-base` |
| 加载骨架 | `animate-pulse` + `bg-bg-muted` | 系统默认 |

---

## 7. Accessibility

- 所有交互元素 `tab` 可达，焦点环 `ring-2 ring-[--color-ring] ring-offset-2`
- 数字旁加 `aria-label` 完整说明（如 "净值 12 万 3 千 4 百 5 十 6 元"）
- 颜色不是唯一的信息载体：涨跌色之外还有 `↑` `↓` 箭头 icon
- 雷达图配 `<table>` 形式的纯文本备选（`sr-only`）

---

## 8. 实现优先级（让 ui_implementer 按顺序做）

1. HERO 区五指标卡 — **必做**，最高视觉影响
2. Action Panel Tab 重构 — 现有有，需要按 token 重写
3. Holdings 卡表格 — 现有 student-allocation-panel，需要按新 token + tabular-nums 重做
4. 操作时间线 — 新增
5. Mr.Brown 导师板 — 整合现有 student-tutor-radar
6. 排行榜 — 现有但需要按新 token 重做
7. 移动端 Action Panel 抽屉 — 复用现有 safe-drawer-offset

---

## 9. 验收清单

- [ ] HERO 净值数字在浏览器拉到 375px 仍清晰（不撑出 viewport）
- [ ] Action Panel 在 sticky 状态下不遮挡 Holdings 表格
- [ ] 涨跌色全部走 `--color-up` / `--color-down`，grep 不到硬编码
- [ ] 所有金额用 `font-mono tabular-nums`，从字号变化时数字不跳
- [ ] 键盘 Tab 顺序符合视觉阅读顺序
- [ ] 浏览器开 prefers-reduced-motion 时所有动画退化为纯透明度
- [ ] 切换 4 个 demo 学生账号都能正常展示，无空白屏
