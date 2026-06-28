## 任务中心盲盒升级集成图

### 概览

当前 `/student/quests` 的任务中心已具备基础盲盒翻卡交互、抽卡机制和装饰卡库。本升级将其转变为**设计师玩具 / POP-MART 盲盒级别的高保真收藏体验**，通过编号系列、色彩身份、稀有度框架、3D 吉祥物和英雄海报级 UI，大幅提升参与度与留存。

---

### 一、核心数据模型变更

#### 1.1 `QuestCard` 扩展（`src/lib/cards.ts`）

**当前状态（L1-10）：**
```typescript
export type QuestCard = {
  id: string;
  name: string;
  rarity: QuestCardRarity;  // "common" | "rare" | "epic"
  artKey: string;
  teachingLine: string;
};
```

**升级变更：**
| 字段 | 类型 | 说明 | 目的 |
|------|------|------|------|
| `seriesNum` | `number` | 卡牌编号（如 01/50） | 显示收集完成度 |
| `seriesTotal` | `number` | 系列总数 | 显示目标 |
| `colorIdentity` | `string` | 色值 HEX（如 `#ff6b4a`） | 卡片的个性色彩身份 |
| `tagline` | `string` | 短标语（如"稳健熊=风险管理"） | 卡片头部展示 |
| `mascotUrl` | `string` | 吉祥物 3D 裁图 URL | 用替代默认头像 |
| `rarity` | `extended` | 新增 `legendary` 选项 | `"common" \| "rare" \| "epic" \| "legendary"` |
| `teachingLine` | `string` | 现有财务概念文案 | 保留原用途 |

**示例：**
```typescript
{
  id: "card-stable-bear",
  name: "稳健熊",
  seriesNum: 3,
  seriesTotal: 12,
  rarity: "rare",
  colorIdentity: "#5ddc8e",
  tagline: "风险管理 ≈ 风险觉察",
  mascotUrl: "/brand/mascots/stable-bear-3d.webp",
  artKey: "STEADY_GUARDIAN",
  teachingLine: "保持 20% 现金安全垫能让坏情况下保持选择权。"
}
```

#### 1.2 `StudentQuestItem` 扩展（`src/lib/quests.ts` L11-22）

**新增字段：**
| 字段 | 类型 | 说明 |
|------|------|------|
| `seriesId` | `string` | 归属系列（如 `"animal-finance-guardians"`） |
| `mascotName` | `string` | 吉祥物中文名 |
| `mascotColorHex` | `string` | 该任务的色彩身份 HEX |
| `mascotImageUrl` | `string` | 吉祥物插画 URL（用于任务卡正面、盲盒设计） |
| `rarity` | `string` | 升级到 `"common" \| "rare" \| "epic" \| "legendary"` |

**何处使用：** 在 `QuestBlindBoxArt`、`QuestCommanderPanel` 和 新 **吉祥物领取弹窗** 中生成色彩主题和形象。

#### 1.3 CardCollectionItem 元数据扩展（`src/lib/db/repo`）

**在 `meta` 中补充：**
```typescript
meta: {
  questId: string;
  questTitle: string;
  reward: string;
  seriesId: string;           // NEW
  mascotName: string;         // NEW
  mascotColorIdentity: string;// NEW
  rarity: QuestCard["rarity"];
  // 既有字段
  runId, round, seed
}
```

---

### 二、组件级变更与新增

#### 2.1 现有组件 RESTYLE

| 组件名 | 位置 | 当前职责 | 升级方向 | 具体改动 |
|--------|------|---------|---------|---------|
| `QuestCardArt` | L202-246 | 渲染卡面插画 | 添加系列编号、色彩框架 | 在 `L236` 的 rarity badge 左边加 `seriesNum/seriesTotal` 大号显示；背景渐变用 `card.colorIdentity`；卡底加 `tagline` 文案 |
| `QuestCardFallbackArt` | L178-200 | 回退占位图 | 同上 | 同上逻辑，用纯色背景代替插画 |
| `QuestCardBackArt` | L248-272 | 卡牌背面"待揭晓" | 升级为软萌风格 | 背景改为柔和渐变（参考图2 的 pastel 配色）；文案改为"PLEASE SMILE"文案区；加可爱的左边竖条纹装饰 |
| `QuestBlindBoxArt` | L476-565 | 正面盲盒 3D 角色 | 升级美学、加编号 | 顶部加大型 `#NN` 编号徽章；角色名称从 `theme.creature` 改为 `quest.mascotName`；加 foil 反光纹理(伪) via SVG 覆层；底部加"Collectible Series" 文案 |
| `QuestCommanderPanel` | L567-669 | 指挥官面板 + 任务选择 | 改造为 mascot 获得弹窗触发器 | 左侧大图改为吉祥物集合展示(参考图3 3x3 grid)；右侧选择切换改为"选择你的吉祥物导师" flow |
| `QuestDetailDialog` | L671-711 | 详情弹窗 | 补充收集提示 | 加"系列进度"条（如 3/12）；标记当前卡片在系列中的位置 |
| `AchievementBadgeArt` | L790-825 | 成就徽章 | 彩化 & 稀有度框架 | 解锁时加稀有度彩色框（epic=紫，rare=蓝，legendary=金）；加微动画 shine |

#### 2.2 新增核心组件

##### **A. QuestCardRarityFrame** (新建 `src/components/student/quest-card-rarity-frame.tsx`)

用于 rarity 的可视化框架，4 档稀有度对应不同框效果。

```typescript
type QuestCardRarity = "common" | "rare" | "epic" | "legendary";

interface QuestCardRarityFrameProps {
  rarity: QuestCardRarity;
  children: React.ReactNode;
  className?: string;
}

// 四档视觉映射：
// common: 淡色方形边框，无特效
// rare: 蓝色辉光边框 + 微内阴
// epic: 紫/橙双色渐变边框 + 脉冲辉光
// legendary: 金色foil边框 + 扫光动画(GSAP)
```

**使用位置：**
- `QuestCardCollection` L737 每张卡片的外壳
- 新的吉祥物奖励卡

##### **B. QuestCardSeriesIndicator** (新建 `src/components/student/quest-card-series-indicator.tsx`)

显示编号与收集完成度的进度条。

```typescript
interface QuestCardSeriesIndicatorProps {
  current: number;    // seriesNum
  total: number;      // seriesTotal
  seriesId: string;
  ownedCount: number; // 用户已拥有该系列的卡数
}

// 样式：顶部 badge "3/12 已收藏"，下方进度条
```

##### **C. MascotRewardModal** (新建 `src/components/student/mascot-reward-modal.tsx`)

**吉祥物获得弹窗**——参考设计图 4：编号 01-06、MY TURN 贴纸、大号英文名、tagline、"COME PLAY WITH THEM" CTA。

```typescript
interface MascotRewardModalProps {
  quest: StudentQuestItem;
  mascotCard: QuestCard;
  onClose: () => void;
  isFirstTimeReward?: boolean;
}

// 视觉组成：
// - 背景：bold duotone 或 solid 色（由 mascotColorHex 驱动）
// - 顶部数字：#01-06 编号(使用 seriesNum)
// - 贴纸："MY TURN" / "系列名"  
// - 中央：3D 吉祥物大头照 (mascotUrl)
// - 标题：huge display-2xl font 的英文名 + 下行中文
// - 标语：tagline + 财务概念说明
// - 按钮："好！我来和它打卡互动" → 链接到教学内容或下一任务
```

**数据流：**
- 从 `claimQuest()` 成功后触发，与 `drawQuestCard()` 配套
- 传入已完成的任务与对应的抽到的卡片
- 可选"首次获得"模式（加彩带 + 音效提示）

##### **D. QuestCollectionFilters** (新建/重构 `src/components/student/quest-collection-filters.tsx`)

对 `QuestCardCollection` (L713) 中的卡库添加按稀有度、系列筛选。

```typescript
interface QuestCollectionFiltersProps {
  onFilterChange: (filters: CollectionFilterState) => void;
  availableSeries: string[];
  availableRarities: QuestCardRarity[];
}

// 3 个 Tab：
// 1. 全部卡片（默认）
// 2. 按系列分类（dropdown）
// 3. 按稀有度分类（4 个 toggle）
```

##### **E. CollectionCompletionMeter** (新建 `src/components/student/collection-completion-meter.tsx`)

显示全站卡库的系列完成度。

```typescript
interface CollectionCompletionMeterProps {
  collection: QuestCardCollectionView[];
  allAvailableCards: QuestCard[];
}

// 卡片统计：
// - 总卡数 vs 已拥有
// - 系列进度（3/12, 2/8 等）
// - 稀有度分布（common 70%, rare 24%, epic 6%）
// - 下一个可达成稀有度目标
```

---

### 三、API 路由与后端变更

#### 3.1 `POST /api/student/quests/draw` (L40-114)

**现状分析（L87-104）：**
- 已支持 `questId` + `source: "quest_claim"` 的卡片生成
- 使用 `seedFromString()` 确保幂等性
- 返回 `QuestCard` + `CardCollectionItem`

**升级需求：**

| 修改点 | 变更内容 | 原因 |
|--------|---------|------|
| 返回值 | 补充 `seriesInfo: { id, num, total }` | 前端需显示编号 |
| 卡片库 | `questCardDeck` 需包含新字段 | 支持色彩身份、吉祥物 URL 等 |
| 元数据 | 在 `collectionItem.meta` 中存储 `mascotName`, `mascotColorIdentity` | 便于后续查询与展示 |
| 错误处理 | 补充"系列已全集"提示 | 集齐后的反馈 |

**代码位置修改：**
```typescript
// L91: questCardDeck 应已升级为含 seriesNum/seriesTotal
// L104: meta 追加
meta: {
  questId: quest.id,
  questTitle: quest.title,
  reward: quest.reward,
  rarity: card.rarity,
  seriesId: card.seriesId,      // NEW
  mascotName: card.name,        // NEW
  mascotColorIdentity: card.colorIdentity, // NEW
  runId: state.run.id,
  round: state.run.currentRound,
  seed,
}
```

#### 3.2 `POST /api/student/quests` (L1004-1030)

**现状：** 领取任务奖励，更新 `actionLog`。

**升级：**
- 返回值中新增 `mascotData?: { name, imageUrl, colorHex, tagline, seriesInfo }` 
- 便于前端判断是否需要弹窗展示吉祥物获得
- 或在 `draw` 路由中统一处理

---

### 四、前端交互流升级

#### 4.1 任务盲盒翻卡流（保留现有）

```
1. 查看任务盲盒 (QuestBlindBoxArt)
   ↓ 增强：顶部大号编号 #3, 色彩框架, foil 纹理
2. 点击"拆开任务盲盒" (L1468-1472)
   ↓ 同上 GSAP flip
3. 背面显示任务详情 + 卡池背面占位 (L1513-1536)
   ↓ 增强：改为软萌渐变背面 + "PLEASE SMILE" 文案
4. 点击"领取并抽卡"
   ↓ 
```

#### 4.2 吉祥物获得流（新增）

```
1. 任务完成 → 点击"领取并抽卡" (claimQuest → drawQuestCard)
   ↓
2. API 返回 QuestCard + 首次获得标记
   ↓
3. 弹窗：MascotRewardModal
   - 展示吉祥物大图、编号、英文名、tagline
   - 背景由 mascotColorHex 决定（bold duotone）
   - "MY TURN" 贴纸、系列标记
   ↓
4. 用户点击"和它互动" 或关闭
   ↓
5. 卡片自动加入"我的卡库"
   - 展示在 QuestCardCollection (L737+)
   - 附带 rarity frame (新)、series indicator (新)
```

#### 4.3 卡库管理流（升级）

```
QuestCardCollection (L713-767)
├─ 新增筛选器：QuestCollectionFilters
│  ├─ 全部 (default)
│  ├─ 按系列 (dropdown: animal-finance-guardians, ...)
│  └─ 按稀有度 (toggle: common, rare, epic, legendary)
├─ 新增统计条：CollectionCompletionMeter
│  ├─ "已收藏 3/50 张"
│  ├─ 系列进度 (3/12 稳健系列, ...)
│  └─ 稀有度分布 (common 70%, rare 25%, epic 5%)
└─ 卡片网格 (4 列 xl, 2 列 md)
   └─ 每张卡 wrap QuestCardRarityFrame
      ├─ QuestCardArt (+编号, +tagline)
      ├─ series indicator bar
      └─ 教学文案
```

---

### 五、设计 Token 与样式指南

#### 5.1 稀有度配色（扩展 `src/app/globals.css`）

```css
/* 在 @theme inline 块中追加或升级 */

/* Common: 朴素灰 */
--rarity-common-bg: #f3f4f6;      /* slate-100 */
--rarity-common-border: #e5e7eb;  /* slate-200 */
--rarity-common-frame: rgba(16, 23, 38, 0.05);

/* Rare: 清蓝 */
--rarity-rare-bg: #eff6ff;        /* info-50 */
--rarity-rare-border: #93c5fd;    /* info-300 */
--rarity-rare-glow: rgba(59, 130, 246, 0.2); /* blue-500 */

/* Epic: 紫橙双色 */
--rarity-epic-bg: #f3e8ff;        /* purple-100 */
--rarity-epic-border: #d8b4fe;    /* purple-300 */
--rarity-epic-accent: #ff6b4a;    /* 暖橙(与参考图一致) */
--rarity-epic-glow: rgba(168, 85, 247, 0.25);

/* Legendary: 金色 foil */
--rarity-legendary-bg: #fef3c7;   /* amber-100 */
--rarity-legendary-border: #fbbf24; /* amber-400 */
--rarity-legendary-foil: linear-gradient(135deg, rgba(255,215,0,0.8), rgba(255,165,0,0.4));
--rarity-legendary-glow: rgba(245, 158, 11, 0.35);
```

#### 5.2 吉祥物色彩身份（参考图 DNA）

| 系列 | 吉祥物 | HEX | RGB | 财务概念 |
|------|--------|-----|-----|---------|
| 稳健 | 稳健熊 🐻 | #5ddc8e | 绿(down) | 风险管理、现金安全垫 |
| 复利 | 复利龟 🐢 | #10b981 | 翠绿 | 时间复利、长期持仓 |
| 分散 | 分散松鼠 🐿️ | #84cc16 | 青绿 | 分散配置、不赌单一方向 |
| 冷静 | 冷静猫 🐱 | #14b8a6 | 蒂尔 | 观察决策、情绪控制 |
| 谨慎 | 谨慎鹿 🦌 | #f59e0b | 琥珀 | 保守配置、债券理解 |
| 勇气 | 勇气狮 🦁 | #ff6b4a | 橙红 | 适度风险、敢于行动 |

---

### 六、文件级变更清单

#### **必修改文件：**

| 文件路径 | 影响范围 | 具体改动 |
|---------|---------|---------|
| `src/lib/cards.ts` | 类型定义 | 新增 `QuestCard` 字段：`seriesNum`, `seriesTotal`, `colorIdentity`, `tagline`, `mascotUrl`；rarity 新增 `"legendary"` |
| `src/lib/quests.ts` | 类型 & 构建器 | 新增 `StudentQuestItem` 字段：`seriesId`, `mascotName`, `mascotColorHex`, `mascotImageUrl`, `rarity` 升级；`buildStudentQuestPayload()` 中的任务构建需补充这些字段 |
| `src/lib/db/repo` | CardCollectionItem 元数据 | 扩展 `meta` 类型，补充 `seriesId`, `mascotName`, `mascotColorIdentity` |
| `src/app/api/student/quests/draw/route.ts` | API 响应 | L104 的 `meta` 对象新增 `seriesId`, `mascotName`, `mascotColorIdentity` |
| `src/components/student/student-quest-dashboard.tsx` | 主仪表盘 | 导入新组件；`claimQuest()` 成功后判断并展示 `MascotRewardModal`；`QuestCardCollection` 包裹新的 filter 和 meter 组件 |
| `src/app/globals.css` | 设计 token | 新增 `--rarity-*-bg`, `--rarity-*-border`, `--rarity-*-glow` 等 CSS 变量 |

#### **新建文件：**

| 文件路径 | 职责 | 行数估计 |
|---------|------|---------|
| `src/components/student/quest-card-rarity-frame.tsx` | 稀有度框架包装器 | ~120 |
| `src/components/student/quest-card-series-indicator.tsx` | 编号与进度显示 | ~100 |
| `src/components/student/mascot-reward-modal.tsx` | 吉祥物获得弹窗 | ~280 |
| `src/components/student/quest-collection-filters.tsx` | 卡库筛选器 | ~180 |
| `src/components/student/collection-completion-meter.tsx` | 收藏统计条 | ~150 |

#### **现有组件改造（重点位置）：**

| 组件 | 文件 | 行号 | 改动 |
|------|------|------|------|
| QuestCardArt | quest-dashboard.tsx | L202-246 | wrap `QuestCardRarityFrame`；加 series badge；加 tagline；背景渐变用 `card.colorIdentity` |
| QuestCardFallbackArt | quest-dashboard.tsx | L178-200 | 同上 |
| QuestCardBackArt | quest-dashboard.tsx | L248-272 | 改为 pastel 风格；加"PLEASE SMILE"文案区；左边加竖条纹 |
| QuestBlindBoxArt | quest-dashboard.tsx | L476-565 | 顶部加大型编号徽章；底部加"Collectible Series"；foil 纹理(可选 SVG 覆层) |
| QuestCardCollection | quest-dashboard.tsx | L713-767 | 顶部插入 `QuestCollectionFilters` 和 `CollectionCompletionMeter`；卡片外层 wrap `QuestCardRarityFrame` |
| StudentQuestDashboard | quest-dashboard.tsx | L827-1750 | 新增状态 `showMascotReward: boolean`；`claimQuest()` 后置逻辑新增 modal 判断；卡库筛选与统计 state |

---

### 七、数据流示例

#### **A. 新任务项构建（示例 quest.ts）**

```typescript
// 在 buildStudentQuestPayload() 中为每个 quest 增加：
{
  id: "cash-buffer-20",
  title: "安全垫保持 20%",
  category: "risk",
  status: "active",
  progress: 0.65,
  claimable: false,
  claimed: false,
  target: "现金 + 储蓄占总资产 20%",
  reward: "装饰徽章：安全垫守门员",
  coachNote: "安全垫越稳定，突发事件里越不容易被迫卖出。",
  // NEW FIELDS:
  seriesId: "animal-finance-guardians",
  mascotName: "稳健熊",
  mascotColorHex: "#5ddc8e",
  mascotImageUrl: "/brand/mascots/stable-bear-3d.webp",
  rarity: "rare",
}
```

#### **B. 抽卡返回示例**

```json
{
  "card": {
    "id": "card-stable-bear",
    "name": "稳健熊",
    "rarity": "rare",
    "artKey": "STEADY_GUARDIAN",
    "teachingLine": "保持 20% 现金安全垫能让坏情况下保持选择权。",
    // NEW:
    "seriesNum": 3,
    "seriesTotal": 12,
    "colorIdentity": "#5ddc8e",
    "tagline": "风险管理 ≈ 风险觉察",
    "mascotUrl": "/brand/mascots/stable-bear-3d.webp"
  },
  "collectionItem": {
    "id": "col-item-xxx",
    "userId": "user-123",
    "cardId": "card-stable-bear",
    "source": "quest_claim",
    "meta": {
      "questId": "cash-buffer-20",
      "questTitle": "安全垫保持 20%",
      "reward": "装饰徽章：安全垫守门员",
      "rarity": "rare",
      "seriesId": "animal-finance-guardians",      // NEW
      "mascotName": "稳健熊",                       // NEW
      "mascotColorIdentity": "#5ddc8e",           // NEW
      "runId": "run-xxx",
      "round": 12,
      "seed": 456789
    }
  },
  "alreadyDrawn": false
}
```

#### **C. 弹窗触发逻辑**

```typescript
// 在 StudentQuestDashboard.claimQuest() 成功后：
if (drawResult && drawResult.card) {
  // 判断是否为首次领取该系列的卡
  const isFirstInSeries = !cardCollection.some(
    item => typeof item.meta?.seriesId === 'string' && 
    item.meta.seriesId === drawResult.card.seriesId
  );
  
  // 弹窗传参
  <MascotRewardModal
    quest={selectedVisibleQuest}
    mascotCard={drawResult.card}
    isFirstTimeReward={isFirstInSeries}
    onClose={() => {
      // 关闭后，卡自动在卡库中可见（通过 addCollectionItem）
      setShowMascotReward(false);
    }}
  />
}
```

---

### 八、交付验收清单

#### **Phase 1: 数据模型 & 后端**
- [ ] 升级 `QuestCard` 类型定义（新增 7 字段）
- [ ] 升级 `StudentQuestItem` 类型定义（新增 5 字段）
- [ ] 扩展 `CardCollectionItem.meta` 类型
- [ ] 更新 `/api/student/quests/draw` 返回 seriesInfo & mascotData
- [ ] 更新 `buildStudentQuestPayload()` 为每任务补充新字段
- [ ] 更新 `questCardDeck` 内容（卡库数据文件）

#### **Phase 2: 组件开发**
- [ ] 新建 `QuestCardRarityFrame` 组件（4 档稀有度框架）
- [ ] 新建 `QuestCardSeriesIndicator` 组件（编号 & 进度）
- [ ] 新建 `MascotRewardModal` 弹窗（hero poster 设计）
- [ ] 新建 `QuestCollectionFilters` 组件（筛选条件）
- [ ] 新建 `CollectionCompletionMeter` 组件（统计条）
- [ ] 改造 `QuestCardArt` / `QuestCardFallbackArt`（加编号、色彩、tagline）
- [ ] 改造 `QuestCardBackArt`（pastel 风格、SMILE 文案）
- [ ] 改造 `QuestBlindBoxArt`（大编号、foil、系列标记）

#### **Phase 3: 集成 & 流程**
- [ ] 改造 `StudentQuestDashboard` 主组件（modal 状态、卡库整合）
- [ ] 改造 `QuestCardCollection`（插入筛选器 & 统计条）
- [ ] 连接 `claimQuest()` → `MascotRewardModal` 弹窗流
- [ ] 测试幂等性：重复抽卡、refresh 后卡库持久化
- [ ] WCAG-AA 色彩对比验证（新稀有度框、modal 背景）

#### **Phase 4: 样式 & Token**
- [ ] 新增 CSS 变量：`--rarity-*-bg`, `-border`, `-glow`, `-foil`
- [ ] 校验吉祥物色彩身份 HEX 与参考图一致
- [ ] GSAP 动画：legendary frame foil 扫光、modal 入场
- [ ] 移动端响应性（卡库从 4 列 → 2 列 → 1 列）

#### **Phase 5: 文案 & 数据**
- [ ] 编写 12 张卡片的 name / tagline / teachingLine（财务概念映射）
- [ ] 生成/导入 12 张 3D 吉祥物插画（`.webp`, 40KB~80KB）
- [ ] 定义 6 大系列与颜色映射表
- [ ] 翻译 modal 的 CTA 文案（"好！我来和它打卡互动"等）

---

### 九、参考 DNA 到代码的映射

| 参考图 | 最终实现 | 核心组件 |
|--------|---------|---------|
| 1) 任务卡待领取 (dark 3x2) | `QuestCardCollection` 卡网格（dark 模式待定，当前 light） | `QuestCardRarityFrame` + `QuestCardArt` + `QuestCardSeriesIndicator` |
| 2) 任务卡完成后 (pastel 2x2) | `QuestCardBackArt` 软萌背面 & 抽到卡显示区 | `QuestCardBackArt` 重构 + pastel 渐变 |
| 3) 吉祥物待领取 (3x3 solid color) | `QuestCommanderPanel` 左侧改造为吉祥物网格展示（可选升级） | Grid layout + solid bg per mascot |
| 4) 吉祥物获得弹窗 (bold poster 3x2) | `MascotRewardModal` 全屏 overlay | duotone 背景、大编号、3D mascot、英文 display 名、tagline、CTA |

---

### 十、实现优先级

**P0 (关键路径)：**
1. 数据模型升级（types + questCardDeck）
2. `MascotRewardModal` 组件 + 主流程集成
3. `QuestCardRarityFrame` + `QuestCardSeriesIndicator`
4. CSS token 与稀有度配色
5. API 返回值调整

**P1 (高保真)：**
6. `QuestCardArt` / `QuestCardBackArt` / `QuestBlindBoxArt` 改造
7. `QuestCollectionFilters` + `CollectionCompletionMeter`
8. GSAP 动画（foil 扫光、modal 入场）
9. 吉祥物插画生成/导入

**P2 (抛光)：**
10. 移动端响应性微调
11. A11Y 色彩对比验收
12. 文案本地化与财务映射验证

---

### 十一、关键 GSAP 动画清单

| 交互 | 动画 | 持续时间 | Easing | 触发条件 |
|------|------|---------|--------|---------|
| 卡片翻转 | `rotateY 0→180°` | `premiumMotion.duration.reward` (现有) | `premiumMotion.ease.reward` | 点击"拆开任务盲盒" |
| 弹窗入场 | `scale 0.8→1, opacity 0→1` | 0.4s | `back.out(1.2)` | `MascotRewardModal` mount |
| Foil 扫光 | `background-position` 左→右 | 2s loop | `linear` | legendary rarity frame 持续 |
| series indicator bar fill | `width 0→target%` | 0.6s | `power2.out` | 卡片首次渲染 |
| 成就徽章解锁辉光 | `filter: drop-shadow()` pulse | 1.2s loop | `sine.inOut` | achievement.unlocked=true 时 |

---

### 十二、技术债与后续迭代

- **Dark mode quest card art:** 参考图 1 用深蓝背景，当前卡库用白背景。可在 Phase 2 后评估切换时机（可能需配合主题切换）。
- **AI 生成吉祥物插画：** 复用 `scripts/gen-market-images.mjs` 的 GPT-image-2 pipeline → 按 `mascotUrl` 规范 resize+WebP。
- **Legendary rarity 稀有度：** 当前牌库权重（common 70%, rare 24%, epic 6%）须补充 legendary 比例（建议 <1%，需调整权重总和）。
- **国际化：** 当前文案全中文；英文吉祥物名已在设计中预留（如 "Steady Bear" for 稳健熊），待 i18n 框架升级。

---

### 总结

本集成图为 `/student/quests` 提供了**完整的设计师玩具 / 盲盒收藏升级方案**，涵盖：

1. **数据模型** — 编号系列、色彩身份、稀有度、吉祥物映射
2. **5 个新组件** — 稀有度框、编号显示、吉祥物弹窗、筛选器、统计条
3. **5 个现有组件改造** — 加色彩、编号、pastel 背面、foil 框架
4. **API 升级** — 返回 seriesInfo、mascotData、元数据补充
5. **设计 token** — 4 档稀有度、6 吉祥物色彩身份、GSAP 动画
6. **文件清单** — 12 文件改动、5 新建、6 核心改造位置标注

所有改动保留现有翻卡 GSAP、装饰卡幂等性和零战力设计，重点升级视觉层级与收集心理，目标达到 **POP-MART 级别的高保真参与体验**。