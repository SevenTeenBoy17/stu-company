# Student Market Page Spec — 市场信息页 v2

> 路由：`/student/market` · 文件：`src/app/(platform)/student/market/page.tsx` + `src/components/student/student-market-board.tsx`  
> 现状问题（基于第 13 轮反馈）：原本是长纵深布局，第 13 轮改为横向后卡片间距不一致，K 线和雷达图的对齐有问题。  
> 目标：建立 **1 + 2 + 3** 三层网格，让用户视线沿"主股票 → 关键指标 → 横向辅助"自然下沉。

---

## 1. 信息架构

```
┌──────────────────────────────────────────────────────────────┐
│ Page Header                                                    │
├──────────────────────────────────────────────────────────────┤
│ Ticker Tape（轮播条，sticky 在 header 下方）                   │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Row 1 — 主股票卡（1 张，全宽）                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 当前选中股票：K 线（左 60%）+ 关键指标 + 操作（右 40%）│    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  Row 2 — 雷达 + 持仓分析（2 张，等宽）                         │
│  ┌─────────────────────────┐  ┌─────────────────────────┐    │
│  │ 6 维教学观察雷达          │  │ 当前持仓拆解（饼图 + 表）  │    │
│  └─────────────────────────┘  └─────────────────────────┘    │
│                                                                │
│  Row 3 — 观察池 + 行业热度 + 排行（3 张，三等分）               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │ AI 观察池   │  │ 行业热度    │  │ 班级排行    │              │
│  └────────────┘  └────────────┘  └────────────┘              │
│                                                                │
└──────────────────────────────────────────────────────────────┘

[ 浮动 AI 助手按钮 — 右下 ]
```

响应式断点：
- `< md`：全部纵向单列堆叠
- `md ~ lg`：Row 2 横向 2 列，Row 3 横向 2 列 + 1 列单独 1 行
- `lg+`：完整 1 + 2 + 3 网格

---

## 2. Ticker Tape（已存在，需调）

- 现有 `stock-ticker-tape.tsx` 保留 marquee 动画
- 容器变更：
  - `bg-ink-900 text-fg-inverse h-10 md:h-11`
  - 上下边线 `border-y border-border-strong/30`
- 每条 ticker：
  - 名称 `text-body-sm text-white/90`
  - 价格 `font-mono text-body-sm text-white tabular-nums`
  - 涨跌 `text-up` / `text-down` + 箭头 icon

---

## 3. Row 1 — 主股票卡

### 3.1 容器

- `rounded-2xl shadow-panel bg-bg-surface p-6 md:p-8`
- 内部 `grid grid-cols-1 lg:grid-cols-[3fr,2fr] gap-8`

### 3.2 左半：K 线 + 标题

```
┌────────────────────────────────────────────┐
│ [icon] 上证科技 ETF       512000 · 沪市     │
│ ¥3.825 ↑ +0.142 (+3.86%)                   │
│ display-2xl 数字，up 色                      │
├────────────────────────────────────────────┤
│                                             │
│            [K 线图 height 320px]             │
│                                             │
├────────────────────────────────────────────┤
│ 1日 1周 1月 3月 全部（tabs）                │
└────────────────────────────────────────────┘
```

K 线技术：
- 用 lightweight-charts (TradingView 开源) 或 recharts 都行；avoid 自己用 SVG 画 OHLC
- 涨蜡烛 `--color-up`，跌蜡烛 `--color-down`
- 网格线 `rgba(0,0,0,0.06)`
- 主导线 `--color-brand`

### 3.3 右半：关键指标 + 操作

8 个关键字段，2 列 × 4 行：

| 字段 | 字号 | 字体 |
|---|---|---|
| 今开 / 昨收 | body / mono | up/down 色 |
| 最高 / 最低 | body / mono | up/down 色 |
| 成交量 | body / mono | neutral |
| 成交额 | body / mono | neutral |
| 市盈率 | body / mono | neutral |
| 市净率 | body / mono | neutral |

下方两个 CTA：
- `[ 加入观察池 ]` outline brand
- `[ 模拟买入 ]` solid brand

---

## 4. Row 2 — 雷达 + 持仓

### 4.1 6 维教学观察雷达（左）

- `rounded-2xl shadow-md bg-bg-surface p-6`
- header: `text-h3 font-display` "6 维教学观察"
- 雷达图（recharts RadarChart）
  - 6 维度：估值 / 成长性 / 现金流 / 行业地位 / 风险偏好 / 流动性
  - 主轴 `--color-brand`
  - 辅助网格 `border` 色 0.1 透明度
  - 数据点 `bg-brand` 圆点 size 8
- 雷达下方：每个维度一行简短解释 `text-body-sm`

### 4.2 当前持仓拆解（右）

- 同容器
- 上：环形饼图（Donut）显示资产类别占比
  - 各类别配色 — 用 amber / ink / up / down / info 各一档软色
- 下：表格列出 top 5 持仓，结构同 dashboard 的 holdings 表

---

## 5. Row 3 — 三横联

### 5.1 AI 观察池（左）

- 列出 5-7 只当前 AI 推荐观察的标的
- 每条：`flex items-center justify-between py-3 border-t border-border`
  - 左：股票名 + 行业 tag
  - 右：当前涨跌 + "加观察" 小按钮
- header: `text-h3` + "AI 推荐" `text-caption text-amber-700` 角标

### 5.2 行业热度（中）

- 5 个行业横向 bar
- 每个 bar：行业名 + 热度数值 + 颜色填充
  - 进度条颜色：高 = `--color-up`，中 = `--color-warning`，低 = `--color-down`
- 时间窗：底部小字 "今日 / 本周" 切换

### 5.3 班级排行（右）

- top 5 同学，结构类似 dashboard 但更紧凑
- 每条：rank icon + 名字 + 净值 + 与自己的 delta

---

## 6. 关键交互

| 元素 | 交互 |
|---|---|
| ticker 点击 | 滚动到 Row 1 + 切换主股票卡为该标的 |
| K 线缩放 | 滚轮缩放，左右拖动 |
| 雷达点击 | 高亮该维度 + 下方解释滚动到对应行 |
| 持仓饼图 hover | 显示该类别的详细金额 tooltip |
| AI 观察池"加" | POST `/api/market/portfolio-intel` 添加 + toast |

---

## 7. 数据刷新

- ticker：10 秒 client-side polling
- K 线：30 秒 polling（或 WebSocket 如果 AllTick 支持）
- 雷达 / 持仓：手动 / 操作变化触发
- 行业热度：10 分钟服务端缓存

---

## 8. 移动适配关键点

- Ticker Tape 字号缩 1 档（text-caption），高度缩到 36px
- 主股票卡 K 线 height 180px，关键指标改成 2 列 × 4 行（已是）
- Row 2 改成 100% 单列，雷达 max-width 280px 居中
- Row 3 改成横向滚动卡片（scroll-snap-x mandatory）

---

## 9. 实现优先级

1. 网格容器 + 响应式重排 — **必做**
2. 主股票卡（重做 K 线对齐 + 标题字号）
3. 雷达图按 token 重做颜色
4. 持仓拆解（新组件）
5. 行业热度 bar（新）
6. AI 观察池条目刷新视觉
7. 排行卡复用 dashboard 同款

---

## 10. 验收清单

- [ ] 拉到 375px 仍能完整看到主股票卡的价格和 K 线
- [ ] 涨跌色全走 token，K 线、ticker、关键指标都一致
- [ ] K 线图加载有 skeleton 占位，避免 layout shift
- [ ] 雷达图配 `<table>` 备选给 sr-only
- [ ] 不引入额外的 KPI 颜色（如紫色），统一在 amber/ink/up/down/info/warning/error 里
