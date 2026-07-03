# Brown Zone 任务中心 · 收藏卡牌与视觉化任务系统 UI 开发文档

版本：2026-06-27
适用范围：学生登录后 `/student/quests` 任务中心
主要实现文件：`src/components/student/student-quest-dashboard.tsx`、`src/lib/quests.ts`、`src/lib/season-challenges.ts`、`src/lib/pet-rewards.ts`
视觉资产目录：`public/brand/quest-world/`、`public/brand/quest-cards/`、`public/brand/achievement-badges/`
参考资料来源：用户截图、`D:\树德实验中学（清波）\C2\UI补充界面参考` 中的 4 张 UI 参考图

## 1. 本轮升级目标

当前任务中心已经具备“赛季任务、任务盲盒、任务队列、成就墙、宠物奖励”的基础结构，但部分核心区域仍然依赖大段文字说明。对 14-19 岁学生来说，这会带来三个问题：

1. 首屏认知负荷偏高。学生需要先读懂任务描述，再理解下一步操作，缺少“看一眼就知道要做什么”的直觉入口。
2. 游戏感不足。已有动物/盲盒资产很好，但没有系统化覆盖任务目标、路线、队列和奖励，导致视觉体验不够连续。
3. 留存动机不够强。任务完成后的奖励更多是文字和数字，缺少可以收藏、展示、升级、解锁的角色化反馈。

本轮 UI 文档的核心目标是：把红框中“文字密集的任务说明区域”替换为动物、植物、徽章、地图节点、生态路径等视觉化任务表达。界面表层只保留关键信息，详细说明通过点击、翻面、抽屉或弹窗展开。

## 2. 产品定位

任务中心不是普通待办清单，而是 Brown Zone 的“学习探险营地”。

学生看到的不是“做 1 次基金/ETF 实验”，而是“熊猫研究员邀请你完成一次组合实验”；不是“完成目标账户、保护伞或现金管理动作”，而是“乌龟守护者帮你搭建安全底座”。

推荐命名：

- 中文主名：任务中心
- 视觉概念：学习探险营地
- 核心玩法：任务盲盒、生态航线、角色收藏、赛季徽章、宠物成长
- 情绪关键词：轻松、探索、可爱、有目标感、有一点收藏欲
- 视觉关键词：暖琥珀、深海蓝、柔和玻璃、圆润 3D、动物伙伴、植物成长、任务卡牌

## 3. 参考图分析

### 3.1 用户截图 1：指挥官简报 + 今日任务航线

红框问题：

- 左侧“先和指挥官对话，再拆开任务盲盒”氛围很好，但右侧任务航线卡片仍然是普通文字卡。
- 每张路线卡只提供“航线 1 / 可领取盲盒 / 已完成”等文本，没有形成视觉差异。
- 已完成、进行中、待领取状态主要靠小标签，学生需要阅读后才能判断。

改造方向：

- 将右侧 4 张任务航线卡改为“生态航线图”。
- 每条航线由一个动物或植物节点代表：狐狸侦察员、熊猫研究员、乌龟守护者、猫头鹰分析师。
- 节点之间用弯曲路线连接，形成“今天先走哪条路”的地图感。
- 卡片表层只保留：角色图、航线编号、状态环、1 个关键词、1 个 CTA。
- 详细解释放入点击后的翻面卡或右侧抽屉。

### 3.2 用户截图 2：任务盲盒栏 + 任务队列

红框问题：

- 左侧主盲盒卡已经很有质感，但下方大面积空白没有承接“收藏、成长、奖励”的后续动机。
- 右侧任务队列卡片仍然以文字为主，且信息密度和黑色背景视觉压力较大。
- 队列滚动区域虽然有玻璃滚动条，但任务本身不像“可收藏的任务卡”。

改造方向：

- 左侧主盲盒卡下方增加“今日栖息地”或“任务陈列架”，展示已解锁角色、待解锁植物、当前任务宝箱。
- 右侧任务队列改为“迷你卡牌竖列”：每个任务用动物头像、进度圆环、状态胶囊和短标题表达。
- 任务详情不在列表里长篇展示，点击后在主卡区域翻面显示。
- 空白区域必须承担功能：展示收藏进度、下一个奖励、宠物心情或今日学习火苗。

### 3.3 用户截图 3：赛季任务目标卡

红框问题：

- 右侧目标卡包含“市场观察、机会证据、组合实验、安全底座、持有复盘”等重要能力，但全是文字。
- 多个目标卡长得相似，区分度不高。
- 学生无法从视觉上感知哪个目标对应哪种能力。

改造方向：

- 将目标卡改成“生态目标徽章板”。
- 五类目标分别对应五个动物/植物视觉符号：
  - 市场观察：狐狸侦察员 + 雷达叶片
  - 机会证据：猫头鹰分析师 + 放大镜花
  - 组合实验：熊猫研究员 + 竹叶饼图
  - 安全底座：乌龟守护者 + 盾牌蘑菇
  - 持有复盘：企鹅档案员 + 回环藤蔓
- 每个目标卡用图标、进度环、状态、一个短动词表达，例如“去观察”“写证据”“做实验”“建底座”“复盘”。

### 3.4 本地参考图：任务卡待领取

可借鉴元素：

- 高对比黑底卡牌、强编号、角色职业标签、玩具感 3D 角色。
- 卡牌角度略有倾斜，适合做“待领取任务卡”或“抽卡结果”。
- 角色职业与任务能力强绑定，例如 Warrior、Captain、Repairman。

落地方式：

- Brown Zone 的任务角色也应拥有“职业身份”，例如“市场侦察员”“组合研究员”“风险守护者”。
- 盲盒开启前显示卡背，开启后展示角色身份与任务能力。
- 任务卡可以按稀有度分为 Common、Rare、Epic，但只代表装饰和学习轨迹，不代表真实投资能力。

### 3.5 本地参考图：任务完成后显示界面

可借鉴元素：

- 柔和粉、黄、绿、蓝色背景，一张卡一个主角。
- 信息少，角色占主视觉，情绪积极。
- 卡片边缘有票券感和收藏感。

落地方式：

- 已完成任务卡使用柔和浅色背景，减少黑色压迫感。
- 完成态不要再展示长说明，改为“角色庆祝 + 奖励一句话 + 下一步按钮”。
- 可增加“收藏编号”和“能力图标”，增强可收集感。

### 3.6 本地参考图：吉祥物待领取界面

可借鉴元素：

- 多张竖向角色卡统一栅格，颜色差异强，适合做收藏图鉴。
- 每张角色卡结构一致：角色、背景色、名称、按钮。
- 角色可从不同角度或不同状态出现。

落地方式：

- 成就墙和宠物奖励区可以改成“伙伴图鉴”。
- 未解锁角色以半透明剪影或植物种子形态呈现。
- 已解锁角色显示 3D 图案、称号、来源任务和成长阶段。

### 3.7 本地参考图：吉祥物获得弹出界面

可借鉴元素：

- 海报式角色展示，编号极大，背景色醒目。
- 角色像盲盒玩具一样有明确人格和主题。
- 适合用作任务完成奖励弹窗。

落地方式：

- 任务完成后弹出“伙伴登场”或“徽章点亮”。
- 弹窗中不堆叠解释，只保留角色名、能力、来源、一个 CTA。
- 奖励弹窗可以配合粒子、光环、卡片翻转，但必须支持关闭和减少动效。

## 4. 视觉系统原则

### 4.1 先图像，后文字

任务卡表层信息顺序固定为：

1. 动物/植物形象
2. 状态和进度
3. 短标题
4. 一句话行动
5. 详情入口

不要在卡片正面放 2 行以上解释。长说明必须放到背面、抽屉、弹窗或折叠详情里。

### 4.2 一个能力对应一个角色

每类金融学习能力绑定一个角色，长期保持一致，帮助学生形成记忆。

| 学习能力 | 角色 | 植物/道具 | 颜色 | 学生直觉 |
| --- | --- | --- | --- | --- |
| 市场观察 | 狐狸侦察员 | 雷达叶片 | 青绿 + 琥珀 | 先观察，不冲动 |
| 机会证据 | 猫头鹰分析师 | 放大镜花 | 蓝紫 + 米白 | 先找证据 |
| 组合实验 | 熊猫研究员 | 竹叶饼图 | 薄荷绿 + 暖黄 | 分散配置 |
| 安全底座 | 乌龟守护者 | 盾牌蘑菇 | 橄榄绿 + 奶油 | 留出安全垫 |
| 持有复盘 | 企鹅档案员 | 回环藤蔓 | 冰蓝 + 灰白 | 复盘和记录 |
| 现金管理 | 鲸鱼现金队长 | 水滴钱袋 | 海蓝 + 琥珀 | 现金流很重要 |
| 预算生活 | 松鼠账本官 | 橡果账本 | 栗色 + 奶油 | 生活目标也要规划 |
| 排行挑战 | 狮子裁判 | 星形奖杯 | 金色 + 深蓝 | 比的是纪律 |

### 4.3 状态必须可视化

任务状态不要只靠文字。

| 状态 | 视觉表达 | 文案 |
| --- | --- | --- |
| 待领取 | 半开的盲盒 + 微弱呼吸光 | 可领取 |
| 进行中 | 角色拿着工具 + 环形进度 | 进行中 |
| 已完成 | 角色庆祝 + 绿色/琥珀勾选章 | 已完成 |
| 需观察 | 角色拿望远镜 + 蓝色观察点 | 需观察 |
| 锁定 | 种子/剪影 + 小锁 | 待解锁 |

### 4.4 教育边界

任务中心的所有奖励只代表学习轨迹和模拟表现，不代表真实投资能力，不直接诱导真实交易。

禁止文案：

- “收益翻倍”
- “稳赚”
- “必买”
- “冲榜就能赚钱”

推荐文案：

- “先观察，再行动”
- “写下证据，减少冲动”
- “用小实验理解波动”
- “安全垫让你保留选择权”

## 5. 页面级重构方案

### 5.1 赛季任务区：从目标列表改为生态目标板

当前形态：

- 左侧深色赛季说明
- 右侧 5 张文字目标卡

建议形态：

- 左侧保留深色赛季故事卡，强化赛季主题。
- 右侧改成 `SeasonObjectiveHabitat`，展示 5 个生态目标徽章。
- 徽章以 2 列布局排列，最后一个可横跨或居中。
- 每个目标卡包含角色图、目标名、进度环、短动作按钮。

正面示例：

```text
[狐狸侦察员图]
市场观察
0/1
去观察
```

点击或键盘 Enter 后展开详情：

```text
加入 1 个自选观察，并写下为什么值得看。
Mr.Brown 提示：先写理由，再决定是否进入模拟配置。
奖励：雷达叶片徽章
```

组件建议：

- `SeasonObjectiveHabitat`
- `SeasonObjectiveCreatureCard`
- `ObjectiveDetailDrawer`

### 5.2 指挥官简报区：从航线文字卡改为任务路线图

当前形态：

- 左侧氛围图
- 右侧 4 张矩形航线卡

建议形态：

- 左侧保留“指挥官简报”，加一点角色叙事。
- 右侧改为 `MissionRouteMap`。
- 路线节点不是普通卡片，而是“动物伙伴站点”。
- 站点之间用曲线路径连接，路径在页面进入时轻微绘制。

节点结构：

```text
航线 1
[狐狸侦察员]
市场盲盒
已完成
```

路线状态：

- 已完成：节点发光，路径已点亮。
- 进行中：节点轻微浮动，路径为琥珀虚线。
- 待领取：盲盒半开，按钮为“拆开”。
- 锁定：剪影 + 低透明度。

组件建议：

- `MissionRouteMap`
- `MissionRouteNode`
- `MissionPathConnector`

### 5.3 任务盲盒栏：从单张大卡改为盲盒 + 栖息地

当前形态：

- 一张主盲盒卡
- 下方留白过大

建议形态：

- 主卡仍然展示当前盲盒。
- 下方增加 `MissionHabitatShelf`，用来展示：
  - 今日已解锁角色
  - 下一个待解锁角色剪影
  - 当前赛季植物成长进度
  - 宠物心情或学习火苗

布局建议：

```text
┌─────────────────────────────┐
│ 第 1 号任务盲盒              │
│ [大幅角色卡 / 盲盒图]         │
│ [拆开盲盒按钮]               │
├─────────────────────────────┤
│ 今日栖息地                   │
│ [狐狸] [熊猫] [乌龟剪影] [种子] │
└─────────────────────────────┘
```

组件建议：

- `MissionBoxPoster`
- `MissionHabitatShelf`
- `HabitatCreatureToken`
- `NextRewardSeed`

### 5.4 任务队列：从文字列表改为迷你收藏卡队列

当前形态：

- 黑色侧栏
- 任务卡文字多
- 滚动区域较长

建议形态：

- 保留黑色侧栏和玻璃滚动条。
- 每个队列项变为 `MiniQuestCreatureCard`。
- 左侧显示动物/植物图案，右侧显示短标题、进度、状态。
- 长标题自动截断，但详情可通过点击查看。

卡片结构：

```text
[熊猫图] 组合实验
提交 1 次持有复盘
进度 0%
[进行中]
```

组件建议：

- `QuestQueuePanel`
- `MiniQuestCreatureCard`
- `QuestQueueEmptyState`

### 5.5 成就墙：从图标列表改为伙伴图鉴

当前形态：

- 部分成就是图标 + 文本。
- 可爱 3D 资产还没有完全成为主角。

建议形态：

- 改为 `AchievementCompanionWall`。
- 已解锁成就显示 3D 伙伴图。
- 未解锁成就显示种子、剪影或睡眠形态。
- 每个成就都有“头像称号”，例如“起航狐狸”“均衡侦探”“生活规划师”。

视觉规则：

- 已解锁：暖色背景、角色清晰、边框微亮。
- 未解锁：灰蓝背景、角色剪影、提示条件简短。
- Hover：角色轻微抬升，卡面出现亮斑。
- 点击：打开详情弹窗，展示来源任务、学习能力、下一步建议。

## 6. 信息架构：表层少字，详情可展开

### 6.1 卡片表层文字限制

每张视觉任务卡正面建议最多：

- 标题：4-8 个汉字
- 状态：2-4 个汉字
- 进度：如 0/1、60%
- 行动：4-6 个汉字

不建议在正面放完整句子。尤其不要放两行以上解释。

### 6.2 详情内容展示方式

详情内容优先级：

1. 卡片翻面：适合任务奖励、任务目标。
2. 右侧抽屉：适合解释规则、任务原因、Mr.Brown 建议。
3. 弹窗：适合任务完成奖励和角色解锁。
4. Tooltip：只用于短提示，不放重要信息。

### 6.3 降低认知负荷的规则

- 每个任务只强调 1 个核心概念。
- 一屏最多出现 5 个主任务节点。
- 任务详情必须有“为什么做”和“下一步做什么”。
- 不在同一张卡上同时解释收益、风险、资产配置、课程和奖励。

## 7. 前端组件规格

### 7.1 `MissionVisualMap`

用途：替换“选择今日任务航线”的文字卡区。

Props 建议：

```ts
type MissionVisualMapProps = {
  routes: MissionRouteVisual[];
  selectedRouteId?: string;
  onSelectRoute: (routeId: string) => void;
};

type MissionRouteVisual = {
  id: string;
  routeNo: number;
  title: string;
  shortAction: string;
  status: "locked" | "available" | "active" | "done";
  progress: number;
  creatureKey: QuestCreatureKey;
  plantKey?: QuestPlantKey;
  conceptTag: string;
  detail: string;
};
```

UI 行为：

- 点击节点选中路线，主卡更新。
- Hover 节点时角色轻微上浮。
- 已完成路线连接线点亮。
- 键盘 Tab 可以逐个聚焦节点。

### 7.2 `MissionObjectiveCreatureCard`

用途：替换赛季目标文字卡。

Props 建议：

```ts
type MissionObjectiveCreatureCardProps = {
  title: string;
  progressText: string;
  status: "locked" | "active" | "done";
  creatureKey: QuestCreatureKey;
  plantKey: QuestPlantKey;
  actionLabel: string;
  onOpenDetail: () => void;
};
```

UI 行为：

- 正面以角色图和进度为主。
- 点击后打开详情。
- 完成时播放一次轻微 sparkle 动画。

### 7.3 `MissionHabitatShelf`

用途：填补任务盲盒大卡下方空白，展示收藏和成长反馈。

Props 建议：

```ts
type MissionHabitatShelfProps = {
  unlockedCreatures: QuestCreatureKey[];
  nextCreature: QuestCreatureKey;
  seasonProgress: number;
  mood: "curious" | "focused" | "celebrating" | "steady" | "alert";
};
```

UI 行为：

- 已解锁伙伴清晰显示。
- 未解锁伙伴显示剪影。
- 赛季植物根据进度从种子、幼芽、小树到发光果实。

### 7.4 `MiniQuestCreatureCard`

用途：任务队列中每个任务的迷你卡。

Props 建议：

```ts
type MiniQuestCreatureCardProps = {
  title: string;
  category: StudentQuestCategory;
  status: StudentQuestStatus;
  progress: number;
  creatureKey: QuestCreatureKey;
  rewardLabel: string;
  onOpen: () => void;
};
```

UI 行为：

- 单行或双行信息，避免长文本。
- 进度用小圆环或短条表达。
- 点击后主区域切换到对应任务详情。

### 7.5 `MascotRewardModal`

用途：任务完成、盲盒开启、成就解锁时的奖励弹窗。

Props 建议：

```ts
type MascotRewardModalProps = {
  open: boolean;
  creatureKey: QuestCreatureKey;
  rewardTitle: string;
  rewardSubtitle: string;
  sourceLabel: string;
  rarity: "common" | "rare" | "epic";
  onClose: () => void;
  onViewCollection: () => void;
};
```

UI 行为：

- 打开时角色从卡片中央升起。
- 背景有柔和光环，不要全屏闪烁。
- 支持 Esc 关闭。
- `prefers-reduced-motion` 下禁用复杂动画。

## 8. 数据映射建议

短期不需要新增数据库字段，可以先在前端建立映射表，把现有任务 ID 映射到视觉角色。

```ts
type QuestCreatureKey =
  | "fox-market-scout"
  | "owl-evidence-analyst"
  | "panda-etf-researcher"
  | "turtle-safety-guard"
  | "penguin-history-archivist"
  | "whale-cash-captain"
  | "squirrel-budget-accountant"
  | "lion-leaderboard-referee"
  | "rabbit-savings-banker"
  | "robot-radar-helper";

type QuestPlantKey =
  | "radar-leaf"
  | "evidence-flower"
  | "bamboo-pie"
  | "shield-mushroom"
  | "review-vine"
  | "cash-droplet"
  | "acorn-ledger";
```

建议新增映射文件：

`src/components/student/quest-visual-map.ts`

```ts
export const questVisualMap: Record<string, {
  creatureKey: QuestCreatureKey;
  plantKey: QuestPlantKey;
  visualTitle: string;
  shortAction: string;
  conceptTag: string;
  colorTone: "amber" | "mint" | "blue" | "cream" | "rose";
}> = {
  "market-observation": {
    creatureKey: "fox-market-scout",
    plantKey: "radar-leaf",
    visualTitle: "市场观察",
    shortAction: "去观察",
    conceptTag: "市场情绪",
    colorTone: "mint",
  },
  "opportunity-evidence": {
    creatureKey: "owl-evidence-analyst",
    plantKey: "evidence-flower",
    visualTitle: "机会证据",
    shortAction: "写证据",
    conceptTag: "证据链",
    colorTone: "blue",
  },
};
```

## 9. 现有资产复用清单

当前项目已经有很适合本次改造的资产，应优先复用。

可直接用于任务角色：

- `/brand/quest-world/characters/fox-market-scout.webp`
- `/brand/quest-world/characters/owl-evidence-analyst.webp`
- `/brand/quest-world/characters/panda-etf-researcher.webp`
- `/brand/quest-world/characters/turtle-safety-guard.webp`
- `/brand/quest-world/characters/penguin-history-archivist.webp`
- `/brand/quest-world/characters/whale-cash-captain.webp`
- `/brand/quest-world/characters/squirrel-budget-accountant.webp`
- `/brand/quest-world/characters/rabbit-savings-banker.webp`
- `/brand/quest-world/characters/lion-leaderboard-referee.webp`
- `/brand/quest-world/characters/robot-radar-helper.webp`

可直接用于任务卡面：

- `/brand/quest-cards/front-market-composer.png`
- `/brand/quest-cards/front-evidence-builder.png`
- `/brand/quest-cards/front-diversification-scout.png`
- `/brand/quest-cards/front-risk-shield.png`
- `/brand/quest-cards/front-review-anchor.png`
- `/brand/quest-cards/front-cash-buffer.png`
- `/brand/quest-cards/front-balanced-allocator.png`

可直接用于成就墙：

- `/brand/achievement-badges/first-map.webp`
- `/brand/achievement-badges/diversify-detective.webp`
- `/brand/achievement-badges/learning-spark.webp`
- `/brand/achievement-badges/opportunity-scout.webp`
- `/brand/achievement-badges/portfolio-researcher.webp`
- `/brand/achievement-badges/life-planner.webp`
- `/brand/achievement-badges/streak-maker.webp`

## 10. 需要补齐的视觉资产

如果现有素材不足，建议用生图生成以下“原创角色和植物道具”，禁止直接复刻任何现有商业 IP。可以参考玩具感、圆润 3D、动画电影质感，但必须是 Brown Zone 原创角色。

### 10.1 角色图标

目标：1024x1024，透明背景，便于裁剪成卡片头像。

通用提示词模板：

```text
Original cute 3D toy-like animal mascot for an educational finance simulation app,
soft vinyl figure, rounded proportions, warm amber and deep navy accents,
Chinese school-friendly, expressive but not childish, no text, no logo,
transparent background, high quality product render, soft studio lighting,
not based on any existing cartoon character or movie IP.
```

具体角色补充：

- Fox market scout: a small fox explorer holding a compass and a radar leaf.
- Owl evidence analyst: a tiny owl with round glasses holding a magnifying flower.
- Panda ETF researcher: a panda scientist with bamboo pie-chart tablets.
- Turtle safety guard: a turtle with a soft shield shell and mushroom umbrella.
- Penguin history archivist: a penguin carrying a scroll with looped vines.
- Squirrel budget accountant: a squirrel holding an acorn ledger and pencil.

### 10.2 植物/道具图标

目标：512x512，透明背景，用于任务节点、状态角标和详情页装饰。

```text
Original whimsical 3D plant prop icon for a student financial literacy game,
rounded toy-like shape, soft material, warm amber highlights, clean transparent background,
simple silhouette readable at 64px, no text, no logo, not copied from existing IP.
```

建议资产：

- radar-leaf
- evidence-flower
- bamboo-pie
- shield-mushroom
- review-vine
- cash-droplet
- acorn-ledger
- mission-seed
- glowing-compass
- closed-treasure-box
- open-treasure-box

### 10.3 盲盒奖励弹窗背景

目标：1600x900，WebP。

```text
Original premium reward reveal background for a student learning game,
warm amber spotlight, deep navy glass stage, soft particles, gentle toy-store display mood,
no text, no logo, no copyrighted characters, enough empty center space for a mascot,
high-end web UI illustration, cinematic but calm.
```

## 11. 动效设计

项目已使用 GSAP 和 `premiumMotion`，动效应克制但有“高级玩具感”。

### 11.1 页面进入

- 赛季故事卡：从左侧 12px 位移进入，透明度 0 到 1。
- 生态目标卡：按 60ms 逐个 stagger。
- 任务路线连接线：使用 `stroke-dashoffset` 绘制。
- 队列卡：从下方 8px 浮入。

### 11.2 Hover / Focus

- 动物头像上浮 4px，阴影增强。
- 任务卡边框出现琥珀细光。
- 植物节点轻微摆动。
- 按钮箭头右移 3px。

### 11.3 盲盒开启

推荐步骤：

1. 盲盒轻微摇动 400ms。
2. 盒盖上移并旋转 6 度。
3. 暖光从盒内扩散。
4. 动物角色从中心放大到 1。
5. 展示奖励弹窗。

动效必须满足：

- 总时长控制在 1200ms 内。
- 可跳过。
- `prefers-reduced-motion: reduce` 时只做淡入淡出。

### 11.4 完成奖励

- 完成态徽章从 0.8 放大到 1。
- sparkle 粒子数量不超过 12 个。
- 不使用频闪，不使用持续旋转。

## 12. 响应式布局

### 12.1 桌面端 1280px 以上

- 赛季任务区：左 45%，右 55%。
- 指挥官简报区：左氛围图 46%，右路线地图 54%。
- 任务盲盒区：主盲盒 70%，任务队列 30%。
- 任务队列高度固定，内部滚动使用玻璃滚动条。

### 12.2 平板 768-1279px

- 赛季任务区上下排列，目标卡 2 列。
- 指挥官简报上下排列，路线图横向滚动或 2 列。
- 任务盲盒和队列上下排列。
- 主卡宽度不要超过 720px。

### 12.3 手机 390-767px

- 所有区域单列。
- 生态目标卡改为横向滑动卡组。
- 任务路线地图改为竖向路线。
- 任务队列放在主卡下方，不要固定高度超过屏幕 60%。
- 每个点击区域不小于 44px。

## 13. 可访问性要求

所有视觉化替换都不能牺牲可访问性。

- 动物和植物图片必须有 `alt`，例如“狐狸侦察员，代表市场观察任务”。
- 进度环必须提供 `aria-label` 或 `role="progressbar"`。
- 状态不能只靠颜色，必须同时有文字或图标。
- 卡片可点击时应使用 `button` 或带键盘事件的语义控件。
- 弹窗必须有焦点管理、Esc 关闭、关闭按钮。
- 动效遵守 `prefers-reduced-motion`。
- 深色背景文字对比度至少达到 WCAG AA。

## 14. 文案规范

### 14.1 任务卡正面

正面文案应短、动词明确、适合学生。

推荐：

- 去观察
- 写证据
- 做实验
- 建底座
- 去复盘
- 拆盲盒
- 领奖励

不推荐：

- 点击查看相关完整内容
- 进入之后请阅读全部任务说明
- 根据当前行情与资产配置完成对应操作

### 14.2 详情说明

详情说明使用三段：

1. 你要做什么
2. 为什么要做
3. 完成后得到什么

示例：

```text
你要做什么：选择 1 个自选观察，并写下它值得关注的原因。
为什么要做：先把理由写清楚，可以减少看到涨跌后马上冲动交易。
完成后得到什么：点亮“雷达叶片”，解锁狐狸侦察员的观察记录。
```

## 15. 实现分阶段计划

### Phase 1：无新增资产的结构升级

目标：先用现有角色资产替换红框中的文字密集区域。

任务：

1. 新建 `quest-visual-map.ts`。
2. 在赛季目标区接入 `SeasonObjectiveCreatureCard`。
3. 在今日航线区接入 `MissionRouteMap`。
4. 在任务队列中使用 `MiniQuestCreatureCard`。
5. 将长说明迁移到详情抽屉或翻面卡。

验收：

- 红框区域不再以大段文字为主。
- 学生可以不读长段落就知道下一步。
- 页面没有新增后端依赖。

### Phase 2：补齐动物/植物资产

目标：用原创 3D 动物和植物图标统一任务中心视觉。

任务：

1. 根据第 10 节提示词生成缺失资产。
2. 放入 `public/brand/quest-world/characters/` 或 `public/brand/quest-world/props/`。
3. 所有图片转为 WebP，单张建议小于 180KB。
4. 为图片添加 fallback。

验收：

- 所有主任务类型都有唯一角色。
- 未加载图片时仍显示可读 fallback。
- 视觉风格统一，没有明显拼贴感。

### Phase 3：动效和反馈

目标：增加高级但克制的交互反馈。

任务：

1. 路线节点 hover 浮动。
2. 路线连接线进入绘制。
3. 盲盒开启动画。
4. 奖励弹窗角色登场。
5. 完成态 sparkle。

验收：

- 动效流畅，不阻塞点击。
- 低性能设备可关闭复杂动画。
- 没有过度闪烁。

### Phase 4：体验闭环

目标：让任务中心真正提高留存。

任务：

1. 已完成任务可进入成就墙。
2. 任务奖励和宠物成长联动。
3. 每日只推荐 1-2 个重点任务。
4. 加入“下次回来继续”的轻提示。

验收：

- 学生完成任务后获得明确反馈。
- 未完成任务有温和引导，不制造焦虑。
- 任务中心与策略台、市场页、历史复盘形成闭环。

## 16. QA 与验收清单

### 16.1 视觉验收

- 红框中的文字密集区已经改成动物/植物/卡牌主导。
- 正面卡片无超过 2 行的说明文字。
- 动物角色和任务类型一一对应。
- 深色区域文字均为高对比白色或浅色。
- 空白区域有功能价值，不再只是留白。
- 卡片圆角、阴影、边框和品牌色一致。

### 16.2 交互验收

- 点击任务节点能打开详情。
- 点击盲盒能看到开启反馈。
- 任务队列可滚动且滚动条风格统一。
- 完成任务后能看到奖励或已完成状态。
- 键盘可以访问所有任务节点和按钮。

### 16.3 响应式验收

- 390x844：无横向滚动，任务卡可读。
- 768x1024：目标卡 2 列，队列不挤压主卡。
- 1440x1100：主区域横向布局稳定，不出现过大空白。

### 16.4 内容验收

- 所有任务都保留原始教育含义。
- 没有真实荐股、保证收益、诱导交易文案。
- 奖励说明明确“代表学习轨迹”。
- Mr.Brown 提示聚焦反思、证据、风险和下一步验证。

### 16.5 前端质量验收

- 图片有明确尺寸和 `sizes`。
- 图片失败有 fallback。
- 动效遵守 `prefers-reduced-motion`。
- 无控制台错误。
- 无布局溢出。
- 任务过滤为空时有空状态。
- 按钮有 hover、focus、loading、disabled 状态。

## 17. 设计评审结论

本次参考图的真正价值不是“把卡片做可爱”，而是把任务中心从待办清单升级为可探索、可收藏、可成长的学习系统。对青少年用户来说，动物伙伴和植物成长能承担三件事：

1. 降低理解成本：先看图，再读一句话。
2. 提高完成动机：任务完成后有可见收藏反馈。
3. 强化长期记忆：每个金融概念都绑定一个稳定角色。

建议后续实现优先遵循“先替换文字密集区，再补动效，再补新资产”的顺序。这样能最快改善当前用户体验，同时保持代码风险可控。

## 18. 本轮工具与能力使用记录

- `dev-supervisor`：用于记录本轮目标、执行过程和质量门槛。
- `frontend-design`：用于确立高质感、非模板化的视觉方向。
- `front-end-design-checklist`：用于补充网格、色彩、文本、图片、按钮、响应式、可访问性和交付检查项。
- `Box`：本轮未调用。资料均为本地文件，直接读取本地路径更稳定。

## 19. 高保真量化规范与最终实现合同

本节用于补齐“可以直接开工”的细节。后续实现时，以本节为最终命名和规格合同；前文若出现相近组件名，以本节为准。

### 19.1 最终组件命名

| 最终组件名 | 职责 | 替换区域 |
| --- | --- | --- |
| `SeasonObjectiveHabitat` | 赛季目标生态徽章板容器 | 赛季任务右侧目标卡 |
| `SeasonObjectiveCreatureCard` | 单个赛季目标动物/植物卡 | 市场观察、机会证据、组合实验等目标 |
| `MissionRouteMap` | 今日任务航线地图容器 | “选择今日任务航线”区域 |
| `MissionRouteNode` | 单条航线节点卡 | 航线 1-4 |
| `MissionBoxPoster` | 当前主盲盒/任务卡海报 | “第 N 号任务盲盒”主卡 |
| `MissionHabitatShelf` | 今日栖息地/收藏陈列架 | 主盲盒下方空白区 |
| `MiniQuestCreatureCard` | 任务队列迷你卡 | 黑色任务队列列表 |
| `AchievementCompanionWall` | 成就伙伴图鉴墙 | 成就墙 |
| `MascotRewardModal` | 任务完成或盲盒开启奖励弹窗 | 完成反馈 |

不要再新增 `MissionVisualMap` 或 `MissionObjectiveCreatureCard` 等相近命名，避免实现时职责漂移。

### 19.2 卡牌比例与尺寸

参考图的关键不是具体像素，而是“收藏卡比例 + 角色中心视觉 + 少量文字”的结构。

| 组件 | 桌面尺寸建议 | 平板尺寸建议 | 手机尺寸建议 | 比例/结构 |
| --- | --- | --- | --- | --- |
| `MissionBoxPoster` | 宽 100%，高 430-520px | 高 380-460px | 高 360-420px | 约 16:10，角色图居中偏上 |
| `MissionRouteNode` | 220x168px | 200x152px | 180x136px | 约 4:3，小卡片 |
| `SeasonObjectiveCreatureCard` | 220x156px | 200x148px | 168x132px | 横向圆角卡 |
| `MiniQuestCreatureCard` | 100%x132px | 100%x120px | 280x118px 横滑 | 左图右文 |
| `AchievementCompanionWall` 单卡 | 240x320px | 210x288px | 176x252px | 3:4 收藏图鉴 |
| `MascotRewardModal` | 720x520px | 640x500px | 92vw x auto | 海报式奖励 |

圆角规范：

- 主容器：`32px`
- 卡牌：`24px`
- 迷你卡：`20px`
- 标签胶囊：`999px`
- 角色头像框：`28px`

阴影规范：

- 浅色卡：`0 18px 60px rgba(15, 23, 42, 0.08)`
- 深色卡：`0 24px 80px rgba(2, 6, 23, 0.28)`
- 选中卡：`0 0 0 2px rgba(240, 138, 56, 0.35), 0 22px 70px rgba(240, 138, 56, 0.18)`
- 角色浮动：`0 18px 40px rgba(15, 23, 42, 0.18)`

### 19.3 参考图结构拆解

#### 收藏卡正面结构

1. 顶部编号区：左上大编号或小编号，如 `#01`、`航线 1`。
2. 职业标签：如“市场侦察员”“组合研究员”，放在编号旁或右上角。
3. 中央角色：占卡片高度 45%-58%，必须是视觉主角。
4. 侧边符号栏：可选，用 3-4 个小图标表示能力标签，例如观察、证据、风险、复盘。
5. 底部说明条：最多 1 个标题 + 1 行短句。
6. 状态徽章：右上角显示已完成、进行中、待领取、锁定。

#### 任务队列迷你卡结构

1. 左侧 96x96 角色缩略图。
2. 中部标题和短动作。
3. 右侧状态胶囊和进度。
4. 底部细进度条。
5. 点击后展开详情，不在队列内放长说明。

#### 吉祥物图鉴结构

1. 卡片背景使用单一主色，不用复杂渐变。
2. 角色占比大，文字少。
3. 已解锁显示角色全彩，未解锁显示剪影或种子。
4. 每张图鉴卡保留收藏编号和来源任务。

### 19.4 字号与字重

| 层级 | 桌面 | 手机 | 字重 | 用途 |
| --- | --- | --- | --- | --- |
| 页面标题 | 40-48px | 30-34px | 800 | 任务中心、赛季标题 |
| 分区标题 | 28-34px | 24-28px | 800 | 任务盲盒栏、任务队列 |
| 卡片标题 | 22-26px | 18-22px | 800 | 市场观察、组合实验 |
| 短说明 | 15-17px | 14-15px | 600 | 一句话行动 |
| 标签 | 12-13px | 11-12px | 700 | 状态、类别、稀有度 |
| 进度数字 | 18-24px | 16-20px | 800 | 0/1、60%、#1 |

卡片正面不使用低于 12px 的中文正文。中文说明超过 24 个字时必须进入详情层。

### 19.5 色彩 token 建议

优先使用项目已有 token；若需要新增视觉别名，仍应在全局 token 层统一管理。

| 用途 | 推荐值 | 说明 |
| --- | --- | --- |
| 深色主背景 | `#070b1a` / `--ink-950` | 任务队列、指挥官简报 |
| 深色卡片 | `#111827` / `--ink-900` | 迷你卡暗面 |
| 暖琥珀主色 | `#f08a38` / `--amber-500` | CTA、路线高亮 |
| 奶油背景 | `#fff7ec` | 奖励说明条 |
| 薄荷成长色 | `#8bd6c0` | 植物、组合实验 |
| 观察蓝 | `#7aa7ff` | 市场观察、证据 |
| 完成绿 | `#78d8ad` | 完成状态 |
| 锁定灰 | `#e8edf5` | 未解锁背景 |

深色背景上文字规则：

- 主标题：纯白或 `rgba(255,255,255,0.96)`
- 次级说明：`rgba(255,255,255,0.72)`
- 禁止使用低对比灰字放在深色卡片上。

### 19.6 完整任务视觉映射表

| 现有/建议任务 ID | 表层标题 | 角色 | 植物/道具 | 类别 | 稀有度 | 完成态奖励 | fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `market-observation` | 市场观察 | `fox-market-scout` | `radar-leaf` | learning | common | 雷达叶片 | 指南针圆标 |
| `opportunity-evidence` | 机会证据 | `owl-evidence-analyst` | `evidence-flower` | learning | rare | 放大镜花 | 证据花图标 |
| `fund-lab` | 组合实验 | `panda-etf-researcher` | `bamboo-pie` | finance | rare | 竹叶饼图 | 饼图圆标 |
| `safety-cushion` | 安全底座 | `turtle-safety-guard` | `shield-mushroom` | risk | rare | 盾牌蘑菇 | 护盾圆标 |
| `holding-review` | 持有复盘 | `penguin-history-archivist` | `review-vine` | review | common | 回环藤蔓 | 回放圆标 |
| `cash-management` | 现金管理 | `whale-cash-captain` | `cash-droplet` | finance | common | 水滴钱袋 | 钱袋圆标 |
| `budget-ledger` | 生活账本 | `squirrel-budget-accountant` | `acorn-ledger` | discipline | common | 橡果账本 | 账本圆标 |
| `savings-bank` | 储蓄训练 | `rabbit-savings-banker` | `mission-seed` | finance | common | 储蓄种子 | 种子圆标 |
| `leaderboard-review` | 稳健挑战 | `lion-leaderboard-referee` | `glowing-compass` | competition | epic | 狮子裁判章 | 奖杯圆标 |
| `radar-helper` | 知识火花 | `robot-radar-helper` | `spark-core` | learning | epic | AI 火花 | 星形圆标 |

状态映射：

| 任务状态 | 正面视觉 | 行动按钮 | 是否可点击 |
| --- | --- | --- | --- |
| `locked` | 剪影 + 种子 + 小锁 | 待解锁 | 可点开查看条件 |
| `watch` | 角色拿望远镜 + 蓝点 | 去观察 | 可点击 |
| `active` | 角色工作中 + 环形进度 | 继续任务 | 可点击 |
| `done` | 角色庆祝 + 完成章 | 领奖励 | 可点击 |
| `claimed` | 角色坐在陈列架 + 已收藏 | 查看图鉴 | 可点击 |

### 19.7 移动端参考图转化规则

移动端不能简单把桌面三栏压窄，应使用“卡组 + 底部详情”的模式。

手机布局顺序：

1. 赛季故事摘要
2. 生态目标横滑卡组
3. 当前主盲盒
4. 今日栖息地
5. 任务队列横滑卡组
6. 成就伙伴图鉴

移动端交互：

- 目标卡横滑时保留 1.15 张卡露出，提示还有更多。
- 顶部可有小图标导航：目标、盲盒、队列、图鉴。
- 长详情通过底部抽屉展示，避免全屏大弹窗。
- 收藏按钮固定在卡片右上角，但尺寸不小于 44px。
- 触控态使用 120ms 缩放到 0.98，不使用 hover-only 信息。

小屏信息密度：

- 单卡正面最多 1 个标题 + 1 个进度 + 1 个动作。
- 正文说明不超过 20 个汉字。
- 详情抽屉最多先展示 3 条信息，更多内容折叠。

### 19.8 留存与低认知负荷验收指标

设计验收不只看“好不好看”，还要能观察学生是否更容易使用。

建议验收指标：

| 指标 | 目标 |
| --- | --- |
| 首屏 3 秒理解 | 学生能在 3 秒内指出“今天推荐先做哪 1 个任务” |
| 表层阅读负担 | 正面任务卡平均文字不超过 28 个汉字 |
| 点击路径 | 从任务中心进入一个任务详情不超过 2 次点击 |
| 每日推荐数量 | 首屏突出 1 个主任务 + 最多 2 个辅助任务 |
| 完成反馈 | 完成任务后 1 秒内出现视觉奖励反馈 |
| 回访引导 | 完成后出现“明天继续/下个任务”提示 |
| 空状态 | 任一筛选为空时显示角色化空状态，不出现大面积空白 |
| 可访问性 | 所有视觉任务节点可键盘访问并有文本替代 |

### 19.9 实现时的禁止项

- 不要把所有参考图元素一次性堆到页面上。
- 不要让每张卡都出现完整任务解释。
- 不要为了可爱牺牲金融教育边界。
- 不要直接使用或高度复刻现有商业 IP 角色。
- 不要只做静态图片，任务状态必须和真实进度联动。
- 不要在移动端保留桌面三栏布局。

### 19.10 最小可交付版本

如果开发时间有限，优先做下面 5 件事：

1. 用 `SeasonObjectiveCreatureCard` 替换赛季目标文字卡。
2. 用 `MissionRouteNode` 替换 4 张航线文字卡。
3. 用 `MissionHabitatShelf` 填补盲盒主卡下方空白。
4. 用 `MiniQuestCreatureCard` 优化任务队列。
5. 用 `MascotRewardModal` 承接任务完成反馈。

做到这 5 件事，就能解决截图中最主要的文字密集、交互弱、空白大和游戏感不足问题。
