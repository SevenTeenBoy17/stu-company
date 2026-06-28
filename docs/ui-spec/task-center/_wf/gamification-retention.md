## 任务中心收集系统:活泼但不剥削的留存设计 (Gamification & Retention Spec)

> 范围:`src/components/student/student-quest-dashboard.tsx`(UI)、`src/lib/quests.ts`、`src/lib/cards.ts`/`src/lib/content.ts`(牌库)、`src/lib/season-challenges.ts`、`src/lib/pet-rewards.ts`、`/api/student/quests/draw`。本节只设计**收集-揭示-回访循环**与其度量假设;所有奖励严格遵守仓库现有不变量——**装饰奖励零战力、零净值、不进排行榜**(`claimQuestReward` summary、`benefits.guardrail` 已落地)。每条机制都给出可落地的符号/字段改动和一个可测留存假设。

### 设计第一性原理:为什么"收集"对 K12 财商是合法的

参考图的 POP-MART/NFT 美学带着真实的成瘾性张力。我们用一条硬规则把它锚定在教育侧:**每张卡、每只萌宠、每个稀有度,都是一个"已掌握的金融概念"的可视化凭证,而不是一个待赌的彩票**。`questCardDeck` 现状已经做对了——每张卡有 `teachingLine`(冷静观察者→"先写证据再行动"、风险护盾→"如果判断错了会怎样")。收集的"完成度焦虑"被重定向为**"概念地图的空白格"**,这是被允许的教育动机,而 gacha 的"差一点就中"被重定向为**"差一个概念就学完一个主题"**。

| gacha 暗黑模式 | 本系统的教育化替代 | 落地锚点 |
| --- | --- | --- |
| 付费抽卡 / 保底氪金 | 完成真实学习行为才抽卡(`quest.claimable` 门槛) | `draw/route.ts:69` `if (!quest.claimable && !quest.claimed)` |
| 随机性制造亏损追逐 | 抽卡**幂等**:同一任务永远同一张,无重复消耗 | `existingCardForTrigger` + `alreadyDrawn` 短路 |
| 限时 FOMO 倒计时惩罚 | 进度永久保留,"差 N 张"是邀请不是威胁 | `initialCollection` 持久化 + 文案改造(见 4.2) |
| 稀有度=金钱地位 | 稀有度=概念深度(common 基础→epic 系统思维) | `content.ts` epic = 市场作曲家/黑天鹅导航员(系统级概念) |

---

### 1. 变量奖励但公平:把抽卡从"赌"改成"揭示掌握"

#### 1.1 现状诊断
`drawCard`(`cards.ts:53`)已是**确定性 PRNG**(`mulberry32` + `seedFromString`),稀有度权重 `common:70 / rare:24 / epic:6`。这给了我们一个其他 gacha 没有的伦理优势:**结果对每个任务是预先确定的**(seed = `userId:runId:round:questId:source`)。变量性仅存在于"学生还没拆到这张"的主观体验里,客观上是固定映射——这是"可变奖励的多巴胺,但无随机损失"。

#### 1.2 改动:把稀有度与"任务难度"绑定,消灭"完成难任务却抽到普卡"的挫败
当前 `drawCard` 对所有任务用同一权重池,可能让"连接目标账户与保护伞"(`goal-protection-pair`,需两类动作)这种高门槛任务抽到 common,而"写 1 张机会观察单"(单动作)抽到 epic,**奖励与努力解耦**,这是隐性不公平。

引入**稀有度地板(rarity floor)**——纯函数,不破坏 `cards.ts` 的无随机性约束:

```ts
// src/lib/cards.ts — 新增,保持纯函数
export type QuestEffort = "light" | "standard" | "deep";

const RARITY_FLOOR: Record<QuestEffort, QuestCardRarity> = {
  light: "common",
  standard: "common", // 仍可向上抽到 rare/epic
  deep: "rare",       // 深度任务保证 ≥rare:努力被尊重
};

export function drawCard(
  deck: readonly QuestCard[],
  ownedCardIds: Iterable<string>,
  seed: number,
  effort: QuestEffort = "standard",
): QuestCard {
  const floor = RARITY_FLOOR[effort];
  const floorOrder: QuestCardRarity[] = ["common", "rare", "epic"];
  const minIdx = floorOrder.indexOf(floor);
  const eligible = deck.filter((c) => floorOrder.indexOf(c.rarity) >= minIdx);
  // …其余逻辑沿用,在 eligible 上 pickRarity + 去重
}
```

`questId → effort` 的映射放在 `quests.ts` 的 `StudentQuestItem` 上加一个 `effort` 字段(`goal-protection-pair`/`fund-lab-first-plan`/`wealth-review-plan` = `"deep"`;单动作任务 = `"light"`),`draw/route.ts:91` 传入 `quest.effort`。

> **留存假设 H1**:深度任务保证 ≥rare 卡后,**深度任务(`fund_lab`/`protection`/`wealth_review`)的领取率 ↑**。度量:`action_log` 中 deep-effort `quest_reward_claim` 占比,目标周环比 +15%。证伪条件:若 deep 任务领取率不变,说明卡稀有度非动机,回滚地板逻辑。

#### 1.3 "保底进度"可见化:消除随机焦虑
参考图1的 `42/50` 数字徽章是 DNA。把它做成**收集进度的诚实承诺**:在 `QuestCardArt` 卡面左上角渲染 `#NN/12`(`content.ts` 教学卡共 12 张),并在抽卡揭示时告诉学生"这是你概念图鉴的第 N 个"。关键文案:**"再完成 2 个任务,你就能集齐'风险管理'这一套"**——把随机性框成确定的进度。

---

### 2. 收集完成度仪表 + "差 N 张集齐"善意助推

#### 2.1 新数据结构:把 12 张卡分成"概念套系"
当前 `questCardDeck` 是扁平 12 张。参考图的"series / 小IP"水印 DNA 要求**套系结构**。在 `content.ts` 给每张卡加 `series`:

```ts
// content.ts — questCardDeck 每张卡加 series 字段
export type QuestCardSeries = "foundations" | "risk-control" | "systems-thinking";
// foundations(5 common): 冷静观察者/现金缓冲垫/复盘锚点/分散侦察员/证据搭建者
// risk-control(5 rare):  风险护盾/板块制图师/回撤侦探/均衡配置师/行为镜像
// systems-thinking(2 epic): 市场作曲家/黑天鹅导航员
```

套系即学习单元:集齐 `foundations` = 掌握"先证据后行动"的基础工具箱。这把"集卡"和"投教课程进度"语义对齐(呼应 `LearningProgressSummary`)。

#### 2.2 新组件 `CollectionMeter`(放在 `QuestCardCollection` 顶部)
现状 `QuestCardCollection`(`student-quest-dashboard.tsx:713`)只显示 `{items.length} 张已收藏`,**没有完成度上下文**。新增一个纯展示组件,数据由新纯函数 `buildCollectionProgress(items, questCardDeck)` 计算:

```ts
// src/lib/cards.ts — 纯函数,可单测(配套 cards.test.ts)
export interface SeriesProgress {
  series: QuestCardSeries;
  label: string;       // "基础工具箱"
  owned: number;
  total: number;
  missingNames: string[];   // 用于"差 N 张"助推
  complete: boolean;
}
export function buildCollectionProgress(
  deck: readonly QuestCard[],
  ownedCardIds: Iterable<string>,
): SeriesProgress[] { /* group by series, diff owned */ }
```

UI 渲染三条套系进度条(沿用现有 `bg-gradient-to-r from-brand via-warning to-up` 进度条样式),每条下方一句**善意助推文案**:

| 状态 | 文案(简体中文,非威胁) |
| --- | --- |
| owned < total | `还差 1 张「回撤侦探」就能集齐风险管理套系——去完成"完成 4 次回合复盘"任务` |
| 1 张就差 | `就差最后 1 张!这套概念图鉴马上点亮` |
| complete | `✓ 风险管理套系已集齐,你已经掌握这组工具的语言` |

**关键约束**:文案永远指向**一个具体的真实学习行为**(任务 id),"差 N 张"必须可通过学习达成,绝不可通过"再抽一次"达成(因为抽卡幂等)。`missingNames` 直接映射到产出该卡的任务,点击跳转 `QuestDetailDialog`。

> **留存假设 H2**:"差 1 张"套系助推会驱动学生**完成产出缺失卡的那个具体任务**。度量:展示 `missingNames` 含某 questId 的助推后 48h 内该 quest 的完成率,对照无助推基线,目标 +20%。这是"完成度焦虑→定向学习行为"的转化,而非"焦虑→更多抽卡"(后者被幂等堵死)。

#### 2.3 反暗黑护栏:完成度永不"过期"、永不"重置"
- 进度由 `card_collection` 表持久化(`listCardCollectionForUser`),**无赛季清零**。区别于赛季挑战(`season-challenges.ts` 按周轮换),收集图鉴是**永久成长资产**。
- 助推 copy 禁用倒计时词("限时""今天必须""错过就没了")。`CollectionMeter` 不渲染任何 `setInterval` 倒计时。
- 在 `CollectionMeter` 角落保留现有 guardrail 句式:`卡片只记录学习与复盘轨迹,不改变净值、战力或排行榜`(已存在于 `:728`),确保家长/教师扫一眼即知非氪金。

---

### 3. 学习驱动的连续性(streak):奖励"回来学",不惩罚"漏一天"

#### 3.1 现状诊断:streak 绑定的是"净值连升",不是"学习连续"
`overview.streakCurrent/streakBest`(`quests.ts:464`)来自 `computeStreak(run)`(`simulation.ts:645`),它统计**净值连续上升的回合数**。这有一个伦理 bug:**它奖励市场运气**(净值涨=streak↑),而 streak 在游戏化里是强回访钩子。把强钩子挂在运气上,既不公平也教坏行为(鼓励追涨)。

#### 3.2 改动:引入"学习日历 streak"——基于**回访学习行为**而非市场结果
新纯函数 `computeLearningStreak`,统计**有学习/复盘动作的不同自然日(北京时间)的连续数**——动作类型用现有 `action_log`:`opportunity`/`wealth_review`/`fund_lab`/`advance`/`quest`(领奖),不包括纯 `trade`(避免奖励刷单)。

```ts
// src/lib/quests.ts — 新纯函数,now 注入保持可测
const LEARNING_ACTIONS = new Set<ActionLog["type"]>([
  "opportunity", "wealth_review", "fund_lab", "auto_invest", "advance", "quest",
]);
export function computeLearningStreak(
  run: ScenarioRun,
  now = new Date(),
): { current: number; best: number; activeToday: boolean } {
  // 按 timestamp 折叠到 Asia/Shanghai 自然日;统计连续天数
  // activeToday:今天是否已有学习动作(用于"今天还没练"的温和提示)
}
```

在 `overview` 加 `learningStreakCurrent/Best/ActiveToday` 三字段,hero 区第二张卡("净值连升")**改成"学习连续天数"**,旧的净值 streak 降级为日历里的一个 tone(已在 `buildCalendar` 体现)。

#### 3.3 反暗黑的 streak:**宽容机制(streak freeze)**,不做断签惩罚
gacha streak 的暗黑点是"断一天清零"制造焦虑驱动强迫回访。教育版必须宽容:

- **不显示"连续 X 天即将断签"的红色警告**。
- 提供**每周 1 次自动"补签"宽容**:`computeLearningStreak` 允许 streak 中存在最多 1 个无学习的间隔日不清零(纯函数内实现,无需用户操作,无需付费)。文案:`你这周有一次"安心假",漏一天也不会断——学习是马拉松不是打卡机`。
- streak 奖励**只给装饰**(萌宠 `mood: "celebrating"` + 一个连续主题贴纸),`pet-rewards.ts` 已有 `streakXp = streak.best * 22`——改为读 learning streak,XP 仍只影响**萌宠等级(装饰)**,不触碰战力。

> **留存假设 H3**:学习 streak + 安心假会**提升 D1/D7 回访率**且**不增加焦虑性刷单**。度量:(a)有学习动作的 DAU 中连续 2+ 天回访比例,目标 D7 +12%;(b)护栏指标——`trade` 动作占总动作比不上升(证明回访是来学不是来刷)。若 trade 占比上升,说明 streak 设计诱发了刷量,需收紧 `LEARNING_ACTIONS`。

---

### 4. 稀有度多巴胺的伦理实现 + 揭示的"活泼"瞬间

#### 4.1 三档稀有度的揭示分级(呼应参考图的两种情绪)
参考图给了两套美学:**深色海报(rare/epic)** 和 **柔色 pastel(common)**。把它做成揭示强度的分级,让稀有揭示**更隆重**但**不让普通揭示让人失望**:

| 稀有度 | 卡面情绪(已有 `rarityMeta`) | 揭示动效(GSAP,`animateQuestCard` 之后追加) | 音/触觉 |
| --- | --- | --- | --- |
| common | pastel 柔色(参考图2:PLEASE SMILE 暖调) | 翻卡 + 轻微 `back.out(1.4)` 弹入(已有日历用过) | 无 |
| rare | 深色 + brand foil 边(参考图1 Normal ribbon) | 翻卡后卡面 `boxShadow` glow 脉冲 1 次 | 可选轻震动 |
| epic | 深色海报 + 大字 name(参考图4 MY TURN) | 全屏短暂 confetti(`@gsap/react` timeline)+ 卡面缩放 hero 揭示 | 可选 |

实现挂在现有 `drawQuestCard` 成功后,读 `item.card.rarity` 决定 timeline。**所有动效尊重 `prefers-reduced-motion`**——`useGSAP` 里已有 `matchMedia` 短路分支(`:855`),epic confetti 必须复用该守卫。

#### 4.2 反"差一点点"暗黑模式:把 near-miss 设计**移除**
gacha 用"差一点抽到 SSR"制造再抽冲动。本系统**根本没有这个杠杆**(幂等抽卡),但要主动确保 UI 不暗示它:`drawResult` 文案(`:1159`)现状已正确——只说"你抽到了 X,已加入卡库"。**禁止**新增任何"你差一点抽到 epic / 再抽有更大机会"的措辞。稀有度对学生的解释统一为**概念深度**:

```
common = 一个工具(现金缓冲垫)
rare   = 一种判断(风险护盾:错了会怎样)
epic   = 一套系统(黑天鹅导航员:设计不被击穿的结构)
```

在 `QuestDetailDialog` 的"神秘奖励"块加一句稀有度释义,让稀有=学得深,而非运气好。

> **留存假设 H4**:epic 揭示的隆重动效会**提升揭示瞬间的情绪峰值**进而提升次日回访,但**不提升抽卡频次焦虑**(因频次被幂等锁死)。度量:epic 揭示后的 session 时长 + 次日回访,对照 common 揭示。证伪:若学生反复点"补抽装饰卡"(`:1565` 按钮)试图刷 epic,说明系统暗示了赌性——但该按钮对已抽任务返回同一张(`alreadyDrawn` 短路),物理上不可能刷,因此是安全的。

---

### 5. 里程碑庆祝 + "almost there" 进度框架

#### 5.1 三类里程碑(已部分存在,需统一为"庆祝时刻")
| 里程碑 | 触发 | 现有锚点 | 庆祝升级 |
| --- | --- | --- | --- |
| 单任务完成 | `quest.claimable` | `claimQuest` → `drawResult` | 已有,加稀有度动效(§4.1) |
| 套系集齐 | `SeriesProgress.complete` | **新增** | `CollectionMeter` 整条进度条金色脉冲 + 萌宠升阶提示 |
| 赛季达成 | `season.claimable` | `claimSeasonReward`(`:1296`) | 已有,加 hero 海报式揭示 |
| 萌宠升阶 | `petStage` 跨档(seedling→scout→strategist) | `pet-rewards.ts:210` | **新增升阶弹窗**(参考图3 单色身份卡) |

#### 5.2 "Almost there" 框架:把每个进度条的最后 20% 做成"临门一脚"
认知设计:接近完成时动机最强(目标梯度效应)。改 `quests.ts` 让每个 quest 进度 ≥0.8 但 <1 时,`coachNote` 动态替换为**临门一脚提示**:

```ts
// quests.ts — withClaimState 增强或在 build 时注入
function almostThereNote(quest, base: string): string {
  if (quest.progress >= 0.8 && quest.progress < 1) {
    return `就差最后一步!${base}`; // 例:分散度 68→72 只差 4 分
  }
  return base;
}
```

UI 侧:进度条 ≥80% 时加一个 `data-almost-there` 属性,触发轻微 pulse 动效(GSAP,respects reduced-motion)。盲盒卡面("第 N 号任务盲盒",`:1434`)在 ≥80% 时角标显示 `差一点就能拆`。

> **留存假设 H5**:对 ≥80% 进度任务加"临门一脚"提示会**缩短"启动→完成"时间**。度量:进度首次达 0.8 到 1.0 的中位回合数,对照无提示基线,目标 -1 回合。

#### 5.3 萌宠升阶弹窗(参考图3 DNA:单色身份卡 + 清晰 3D 形象)
`pet-rewards.ts` 已有 `petStage`/`level`/`xpProgress`,但**前端任务中心没有萌宠面板**(萌宠在 `/student/life` 或独立页)。在任务中心 hero 区接入一个**精简萌宠状态条**(读 `/api/student/pet-rewards`),当 `level` 跨 stage 边界时弹出升阶庆祝。复用 `pet.mood: "celebrating"` 与 `headline`。这把"任务→抽卡→萌宠成长"串成一条可见的成长链,而不是三个孤立系统。

---

### 6. 萌宠人格强化金融概念(参考图4:强个性 IP)

#### 6.1 现状:`questBoxThemes` 已有 12 个动物世界,但"人格"是装饰性的
`questBoxThemes`(`student-quest-dashboard.tsx:292`)定义了狐队长/龟护卫/猫头鹰等 12 个角色 + 世界 + badge,**但角色个性没有承载具体金融教学**——它们只是换皮。参考图4 的 DNA 是"强个性角色 + tagline + 它教你一件事"。

#### 6.2 改动:每个角色 = 一个金融概念的拟人化导师,且与 quest category 对齐
把 12 个 `questBoxThemes` 的 `badge` 升级为**概念人格 + 一句口头禅(tagline)**,且与该 quest 实际训练的能力(`StudentQuestCategory`)绑定:

| 角色 | 金融概念 | 口头禅(tagline,卡背显示) | 对应 category/quest |
| --- | --- | --- | --- |
| 龟护卫(turtle-shield) | 防御/纪律(稳健) | `慢就是稳,稳就是快` | risk / `cash-buffer-20` |
| 复利龟→改用龟护卫升阶态 | 复利 | `时间是我的盔甲` | finance |
| 松鼠会计(squirrel-budget) | 分散/预算 | `别把橡果都埋一个洞` | discipline / `cash-management` |
| 猫侦探(cat-opportunity) | 冷静观察 | `先看证据,再出爪` | learning / `opportunity-first-note` |
| 熊猫研究员(panda-etf) | 分散配置 | `一篮子,不是一颗蛋` | finance / `fund-lab-first-plan` |
| 企鹅档案员(penguin-review) | 复盘 | `每一步都值得归档` | review / `wealth-review-plan` |

实现:`questBoxThemes` 加 `concept`、`tagline`、`category` 字段;`questBoxThemeFor` 现在按 `index` 取(`:471`),改为**优先按 `quest.category` 匹配同概念角色**,让"风险任务"稳定出现龟护卫,建立角色-概念的稳定联想(间隔重复学习)。卡背(`quest-card-back`,`:1475`)在"任务目标"上方加一行 `theme.tagline`,让概念以人格口吻反复出现。

> **留存假设 H6**:角色-概念稳定绑定(而非随机换皮)会**提升概念回忆**。度量:在投教小测中,完成对应角色任务的学生在该概念题正确率,对照随机换皮组,目标 +10%。这把装饰性 IP 转成助记钩子(method of loci 变体)。

#### 6.3 萌宠主角"布朗小栗"的人格一致性
`pet-rewards.ts` 的 `petMood` 已经做得很好——`alert`(风险高时提醒看安全垫)、`focused`(纪律高+学习时鼓励小幅调整)、`celebrating`(刚领奖)。这是**情境化的金融导师人格**。保持不变,只需在任务中心 hero 接入其 `coachNote`,让萌宠在每个收集动作后说一句**强化而非奖励本身**的话(现有 copy 已正确:`奖励不会改变模拟成绩,但会把好行为标记出来`)。

---

### 7. 逐帧"活泼/delight"节拍 (moment-to-moment)

把整个任务中心的关键交互按时间轴排出 delight beats,每个都标注实现锚点与 reduced-motion 行为:

| # | 时刻 | Delight beat | 实现锚点 | reduced-motion |
| --- | --- | --- | --- | --- |
| 1 | 进入页面 | 各 section `autoAlpha 0→1` + `y:20→0` stagger | 已有 `[data-quest-reveal]`(`:864`) | 直接 `autoAlpha:1` |
| 2 | 日历点亮 | `back.out(1.4)` 弹入 | 已有 `[data-calendar-cell]`(`:876`) | set scale:1 |
| 3 | 选任务航线 | 卡片 `-translate-y-0.5` hover | 已有(`:637`) | CSS transition,保留 |
| 4 | 拆盲盒 | 翻卡 `rotateY 0→180` | 已有 `animateQuestCard`(`:892`) | set rotateY 直达 |
| 5 | **盲盒拆开瞬间** | **新增**:盲盒"盖子弹开"微动效(盒盖 mask 上移) | 新增,挂 toggle 翻卡前 80ms | 跳过 |
| 6 | 领取并抽卡 | loading "抽卡中..." → 卡面揭示 | 已有 `isQuestBusy`(`:1558`) | 文案保留,无动效 |
| 7 | **卡面揭示** | **新增**:按稀有度分级(§4.1) | 新增,`drawQuestCard` 成功后 | 跳过 confetti |
| 8 | **套系集齐** | **新增**:`CollectionMeter` 金色脉冲 | 新增 | 静态金色态 |
| 9 | 进度 ≥80% | **新增**:盲盒角标"差一点就能拆" pulse | 新增 `data-almost-there` | 静态角标 |
| 10 | 萌宠升阶 | **新增**:升阶弹窗 | 新增 | 静态弹窗 |
| 11 | 赛季达成 | 按钮 `shadow-glow` + 成功条 | 已有(`:1301`) | 保留 |

**性能护栏**:confetti 用单个 GSAP timeline + ≤30 个 DOM 节点,揭示后 `kill()` 清理;所有新动效走 `contextSafe`(已有 `useGSAP` scope,`:853`),避免 React 19 卸载泄漏。

---

### 8. 反暗黑模式总清单(给家长/教师/合规)

这是可直接放进 `docs/` 或家长报告的承诺表,每条都有代码级保证:

| 暗黑模式 | 本系统的硬保证 | 代码不变量 |
| --- | --- | --- |
| **真实货币** | 全程零支付。抽卡只需完成学习行为 | 无 billing 调用在 quest/draw 路径 |
| **损失追逐** | 抽卡幂等,同任务同卡,无"再抽" | `existingCardForTrigger` + `alreadyDrawn` 短路(`draw/route.ts:73`) |
| **FOMO 倒计时** | 收集图鉴永久不清零,无断签惩罚 | `card_collection` 持久 + streak 安心假(§3.3) |
| **稀有度=地位/金钱** | 稀有度=概念深度,公开释义 | `teachingLine` + §4.2 释义 |
| **暗箱概率** | 概率公开:common70/rare24/epic6 + 深度任务保底 | `QUEST_CARD_RARITY_WEIGHTS` 可在 UI 透明展示 |
| **战力可买/可刷** | 装饰奖励零战力零净值不进榜 | `claimQuestReward.summary`、`benefits.guardrail`、`pet.summary.safetyNote` 已落地三处 |
| **诱导过度游玩** | streak 奖励回访学习,护栏监测刷单 | H3 护栏指标:trade 占比不得上升 |
| **未成年人数据** | 收集进度本地+RLS 持久,无第三方追踪 | `withUserRls()` 路径 |

**透明度面板建议**:在 `QuestCardCollection` 加一个可折叠"抽卡说明"小面板,直接显示 `70% / 24% / 6%` 与"深度任务保底 rare",呼应仓库已有的战力公式透明面板(`powerFormula()`)的诚实文化。这本身是反暗黑的差异化卖点,可写进对家长的销售话术。

---

### 9. 落地优先级与度量仪表盘

| 优先级 | 改动 | 文件 | 假设 | 工作量 |
| --- | --- | --- | --- | --- |
| P0 | `CollectionMeter` + `buildCollectionProgress` + 套系 `series` 字段 | `cards.ts`/`content.ts`/dashboard | H2 | 中 |
| P0 | 学习 streak `computeLearningStreak` + 安心假 + hero 卡替换 | `quests.ts`/dashboard | H3 | 中 |
| P1 | 稀有度地板 `effort` + 揭示分级动效 | `cards.ts`/`draw/route.ts`/dashboard | H1/H4 | 中 |
| P1 | 角色-概念绑定(`questBoxThemes` + tagline + category 匹配) | dashboard | H6 | 小 |
| P2 | "Almost there" 临门一脚 + ≥80% 角标 | `quests.ts`/dashboard | H5 | 小 |
| P2 | 萌宠升阶弹窗接入任务中心 | dashboard + `/api/student/pet-rewards` | 综合 | 中 |
| P3 | 透明度面板(概率公开) | dashboard | 信任/合规 | 小 |

**留存度量埋点**(建议复用 `log_analytics` / action_log):`quest_claim` 率、deep-task 领取率、套系集齐数、learning streak 分布、D1/D7 回访、护栏指标 `trade占比`。所有假设都带证伪条件,任一护栏触发(刷单上升 / 焦虑投诉 / 家长负反馈)即回滚对应机制——这是教育产品区别于 gacha 的根本:**留存指标服从于学习指标,而非凌驾其上**。

---

### 关键文件清单(供实现 agent)
- `src/components/student/student-quest-dashboard.tsx` — UI:`CollectionMeter`(新)、揭示动效、hero streak 卡、角色 tagline、almost-there、萌宠升阶
- `src/lib/cards.ts` — `buildCollectionProgress`(新纯函数+测)、`drawCard` 加 `effort` 地板
- `src/lib/content.ts` — `questCardDeck` 加 `series` 字段
- `src/lib/quests.ts` — `computeLearningStreak`(新纯函数+测)、`StudentQuestItem` 加 `effort`、almost-there note、`overview` 加 learning-streak 字段
- `src/lib/season-challenges.ts` — 赛季达成 hero 揭示(UI 侧)
- `src/lib/pet-rewards.ts` — `streakXp` 改读 learning streak(仅影响装饰等级)
- `src/app/api/student/quests/draw/route.ts` — 传 `quest.effort` 给 `drawCard`
- 美术管线复用 `scripts/gen-market-images.mjs`(gpt-image-2 → `sharp` → webp ~40KB)产出新角色/升阶态/套系封面位图,落地 `public/brand/quest-world/characters/` 与 `public/brand/quest-cards/`,文件名沿用现有 `theme.asset` / `front-${card.id}` 约定