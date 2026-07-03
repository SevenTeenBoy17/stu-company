# 任务中心盲盒升级 — 设计总监评审punch-list

评审范围:四份草案(integration-map / motion-spec / gamification-retention / asset-pipeline / a11y-states-i18n)。已对照真实代码核验(`cards.ts` 3档稀有度、12卡牌库 5/5/2、`QuestDetailDialog` 现状、`rarityMeta`、`questBoxThemes`、`pet-rewards`)。下列每条标注严重级与可落地动作。

---

## P0 — 阻断级:跨章节自相矛盾 / 破坏参考图DNA核心

### P0-1 `legendary` 第四档在四份草案里直接打架(最严重的不一致)
- **integration-map** 全程把 `legendary` 当既定档(数据模型、CSS token `--rarity-legendary-*`、GSAP foil 扫光、6吉祥物色彩表含勇气狮橙红)。
- **asset-pipeline** §2 新增 2 张 legendary 吉祥物(复利守护龙/纪律哨兵狮),§5/§8 给出扩 `QUEST_CARD_RARITY_WEIGHTS` 的具体方案。
- **gamification-retention** §1.2 的 `floorOrder` 只有 `["common","rare","epic"]`,**根本没有 legendary**——它的稀有度地板逻辑和 asset-pipeline 的四档世界观冲突。
- **motion-spec** §0 和 **a11y-states-i18n** §0 **明文禁止** legendary,引 `cards.ts` 为事实源,要求"先扩枚举与权重"。
- **动作(P0)**:由设计总监拍板一个**单一事实源**。建议:**MVP 锁三档**(尊重 `cards.ts` 现状),legendary 列为"Phase 2 扩展",**所有章节统一加一行**"legendary 在 MVP 视为 epic 顶配,落地需先扩 `QuestCardRarity` 枚举 + `QUEST_CARD_RARITY_WEIGHTS` + `pickRarity` 已前向兼容"。integration-map 必须删掉或显式标注"Phase 2"它对 legendary 的 P0 承诺,否则实现 agent 会去改 `cards.ts` 而 motion/a11y agent 同时禁止——直接死锁。

### P0-2 "色彩身份"在两份草案给了互相矛盾的色值,且违背红涨绿跌铁律
- **integration-map** §5.2 把稳健熊 = `#5ddc8e`(绿)、复利龟 `#10b981`(绿)、分散松鼠 `#84cc16`(青绿)——**4/6 个吉祥物主色是绿色**。
- **asset-pipeline** §2 同一批概念给的是**完全不同的 slug 和色值**(risk-shield=`#10b981`、calm-observer=靛蓝 `#6366f1`、cash-buffer=海蓝)。两表的吉祥物名、概念、色值**对不上**(integration-map 的"稳健熊#5ddc8e" vs asset-pipeline 的"balanced-allocator 熊=紫#a855f7")。
- **DNA冲突**:参考图的"每卡独立色彩身份"要的是**色相分散的6-14色谱**(红/灰蓝/棕/海军蓝/橙/绿)。integration-map 把一半吉祥物压在绿色区间,既丧失"色彩身份"的区分力,又在"红=涨/绿=跌"的金融语境里让"稳健/复利/分散"全部背上"跌"的潜意识色——**教学反信号**。
- **动作(P0)**:以 **asset-pipeline §2 的 14 行色谱为唯一调色板**(它色相分散、slug=card.id 可join、且已论证 legendary 双色对齐 power-score 权重)。**删除 integration-map §5.2 的整张色表**,改为引用 asset-pipeline。明确约束:**绿色最多 1-2 个吉祥物**,且不分配给"稳健/防御"这类正向概念(避免与绿=跌撞车);防御/纪律用蓝或品牌红/金。

### P0-3 参考图3(吉祥物待领取 3×3 solid)在所有草案里几乎丢失
- 四份草案密集覆盖了参考图1(dark卡)、2(pastel背面)、4(获得海报弹窗),但**参考图3(单色solid身份卡 + "Watch Now ▶" pill + 收藏夹网格 + 进度条)几乎没有对应落点**。integration-map §9 仅一句"`QuestCommanderPanel` 左侧改造(可选升级)"——标"可选"等于砍掉。
- 这是**收集系统的核心货架**:参考图3 才是学生浏览"我能集哪些吉祥物/还差哪些"的主界面,是 gamification-retention §2 `CollectionMeter` 的视觉载体。缺它,"收集完成度"就只有数字没有货架。
- **动作(P0)**:新增一节明确把参考图3落到一个**真实组件**——建议 `MascotGalleryGrid`(3×3/响应式),每格单色solid背景(用 asset-pipeline 的 `hex`)+ 3D mascot + 标题 + 进度pill(已拥有/未解锁灰阶)。"Watch Now ▶" pill 改为教育语义"去练习 ▶"(链到产出该卡的quest)。与 `CollectionMeter` 和 `QuestCollectionFilters` 物理合并到一个 view,而不是散在三个组件里。

---

## P1 — 高保真缺口 / 章节内严重短板

### P1-1 a11y-states-i18n 的对话框契约**未被 integration-map 和 motion-spec 采纳**
- a11y §3.2 精准发现 `QuestDetailDialog` **缺焦点陷阱/ESC/返回焦点/`aria-labelledby`**(我已核实代码属实,只有 `role+aria-modal+close按钮`)。它提议 `useFocusTrap` hook 供详情框 + 获得弹窗复用。
- 但 **integration-map** 的 `MascotRewardModal`(§2.2-C)和 **motion-spec** 的 `QuestRewardCelebrationModal`(§3)**各自又起了一个弹窗名**,且都没引用 a11y 的 `useFocusTrap` 契约。三处弹窗、两个组件名、零共享焦点管理 = 必然漏实现 a11y。
- **动作(P1)**:统一**弹窗组件名**(三章用同一个名,建议 `MascotRewardModal`),并在 integration-map 的"新建文件清单"里**显式加 `useFocusTrap` hook** 作为前置依赖,motion-spec §3 的入场timeline 必须声明"焦点管理走 `useFocusTrap`,动效不接管焦点"。

### P1-2 "活泼/delight"的盲盒**开盒物理感**几乎缺席——最大的活泼机会被漏掉
- 参考图的盲盒DNA核心是**"开盒瞬间"**。但翻卡动效(motion-spec §1)本质只是 `rotateY`——这是"翻牌"不是"开盒"。gamification-retention §7 beat#5 提到"盒盖弹开 mask 上移"但只一句、无规格;motion-spec **完全没有盒盖/封缄/撕拉**的动效。
- 当前方案的"活泼"集中在揭晓后的confetti/foil,**开盒过程本身平淡**——而盲盒最上头的就是"拆"的那0.5秒。
- **动作(P1)**:在 motion-spec 新增"§1.5 开盒物理"——盒盖 clip-path 上掀 + 封缄贴纸撕开 + 内部光溢出(`autoAlpha` mask,纯transform)。这是把"活泼"从"奖励装饰"提前到"交互核心"的关键。给 common 也配轻量版(参考图2 pastel 的"PLEASE SMILE"应该在开盒时弹入,而不是静态背面)。

### P1-3 "学习streak替换净值streak"是好洞察,但**破坏现有payload契约且无迁移说明**
- gamification §3 主张把 `overview.streakCurrent`(来自 `computeStreak` 净值连升,我已核实)替换为 learning streak,并加 `learningStreakCurrent/Best/ActiveToday` 三字段。**伦理论证正确**(不奖励运气)。
- 但:`StudentQuestPayload.overview` 是已落地契约,hero区第二卡现绑净值streak。**直接替换会改payload形状**,且 a11y-states-i18n §5.1 的状态表、integration-map 的数据流都没跟着改——三章不同步。"安心假"宽容逻辑(§3.3)也只在 gamification 出现,a11y 的count-up/播报没覆盖。
- **动作(P1)**:降级为**叠加而非替换**——保留 `streakCurrent`,新增 learning streak 字段,hero **并列两张卡**或用tab切换;让 integration-map "数据流"章 + a11y §5.1 状态表同步登记新字段与其空态/播报。把"安心假"写进 a11y 文案表(需要一句对学生可见的解释 + 读屏播报)。

### P1-4 稀有度的**双重编码**(非仅颜色)只有 a11y 提了,其余三章仍只靠颜色/光效区分
- a11y §1.3 正确要求稀有度加**形状/图标编码**(Circle/Diamond/Sparkles)满足 WCAG 1.4.1。但 integration-map 的 `QuestCardRarityFrame`、motion-spec §5 的稀有度阶梯、asset-pipeline §4 的frame treatment **全部只描述颜色+foil+glow**,无图标编码。
- **动作(P1)**:把"稀有度图标 + 文字label 必须始终随框出现"写进 integration-map 的 `QuestCardRarityFrame` props 契约(`icon` 必填)和 asset-pipeline §4 的frame表(每档一个固定图标槽)。foil/glow 一律 `aria-hidden`。

### P1-5 pastel(参考图2)与dark(参考图1)两套情绪的**分流规则缺失**,会撞对比度红线
- a11y §1.2 给了唯一一张**审核过对比度的实色底表**(橙#ea580c白字仅3.0:1只能大字、琥珀#f59e0b白字1.9:1禁用白字)。但 integration-map / asset-pipeline 谈"bold duotone / solid 背景"时**没引用这张表**,asset-pipeline §3.3 的 POSTER_STYLE 还允许任意 `hex` 实色铺背景——直接和 a11y 的白字红线冲突(橙/黄/浅绿系会挂)。
- **动作(P1)**:asset-pipeline §3.3 和 integration-map 的 `MascotRewardModal` 背景色必须**强制走 a11y §1.2 的安全底表**;明确"饱和≥70%且明度≥60%的实色(橙/黄/浅绿/粉)走深墨字方案(参考图2 pastel),不铺白字"。给每个吉祥物 `hex` 预先判定它走"dark海报白字"还是"pastel深墨字",写进 `manifest.mascots.json`(加 `posterInk: 'light'|'dark'` 字段)。

### P1-6 reduced-motion 下**收集体验被掏空**,无静态等价的"完成感"
- motion-spec 各节都给了"瞬时落终值"分支(正确),但 reduced-motion 用户在**揭晓/集齐/升阶**这些情绪峰值时刻只剩"DOM文本已在",**没有静态的视觉庆祝等价物**(无静态光环/无完成态徽章变化)。参考图的隆重感对reduce用户完全丢失。
- **动作(P1)**:为reduce模式定义**静态高保真态**——epic揭晓用静态foil边+静态光环(CSS渐变,非动画)、集齐用静态金色完成态、升阶用静态新stage徽章。"静态≠朴素":让reduce用户也拿到参考图4的海报质感,只是不动。

---

## P2 — 抛光 / 一致性 / 遗漏的delight

### P2-1 命名碎片化(组件名/slug/字段在四章不统一)
- 弹窗:`MascotRewardModal`(integration) vs `QuestRewardCelebrationModal`(motion)。
- 吉祥物字段:`mascotUrl`/`mascotImageUrl`/`mascotColorHex`/`colorIdentity`/`mascotColorIdentity`(integration 自己就有5种叫法) vs asset-pipeline 的 `portrait`/`hex`/`slug`。
- 资产目录:integration 写 `/brand/mascots/`,asset-pipeline 写 `/mascots/portraits/`。
- **动作(P2)**:出一张**命名对照总表**置于所有章节开头。以 asset-pipeline 的 `slug===card.id` + `manifest.mascots.json` 为join权威,integration-map 全文替换字段名。

### P2-2 "差N张集齐"助推与"抽卡幂等"存在**潜在逻辑漏洞**
- gamification §2.2 的助推文案"还差1张X就集齐,去完成Y任务"——但抽卡是 `seedFromString(userId:runId:round:questId)` 确定性映射(我已核实 `drawCard`)。**某个quest在某seed下抽到哪张是预定的**,学生"完成Y任务"抽到的**可能不是缺的那张X**(去重逻辑 `unownedSameRarity` 只在同稀有度内兜底)。助推承诺与确定性抽卡可能对不上。
- **动作(P2)**:要么让"产出缺失卡的quest"做**显式 questId→cardId 映射**(而非靠随机去重),要么把助推文案软化为"完成更多任务,逐步点亮这套"。gamification §2.2 需补一段"如何保证缺失卡可达成"的机制说明。

### P2-3 萌宠系统(pet-rewards 8奖励/12级/3stage)与卡库收集是**两套未打通的进度**
- 已核实 `pet-rewards.ts` 有独立 level/xp/stage/mood。gamification §5.3 想把它接进任务中心,但 integration-map / asset-pipeline 几乎没提萌宠,asset-pipeline 也没为 `petStage` 的3档(seedling/scout/strategist)产出升阶态美术。学生会面对**卡库收集 + 萌宠成长 + 成就墙**三套孤立进度条,认知负担高。
- **动作(P2)**:明确三套进度的信息架构(谁是主、谁是辅),至少在文档里画一张"任务→抽卡→萌宠XP→成就"的统一成长链;asset-pipeline 补 3 个 petStage 升阶态 portrait(复用同pipeline)。

### P2-4 `QuestCommanderPanel` 的去向矛盾
- integration-map §2.1 既说它"改造为 mascot 获得弹窗触发器",§9 又说它改为"3×3 吉祥物网格"。一个组件两个不兼容的新职责。
- **动作(P2)**:拆清——`QuestCommanderPanel`(指挥官/导师面板)保留为入口,新建独立 `MascotGalleryGrid`(P0-3)承载3×3,弹窗是第三个独立组件。

### P2-5 抽卡进行中的**反诈赌护栏文案**未在"补抽"按钮二次确认
- a11y §5.1 + gamification §4.2 都正确指出"补抽装饰卡"按钮命中 `alreadyDrawn` 返回同卡(物理防刷)。但UI上"补抽"二字仍**暗示可再赌一次**。
- **动作(P2)**:把"补抽装饰卡"改为"再看一次这张卡"或"查看已收藏",从措辞层面消除赌性暗示(参考图DNA是收藏不是抽奖)。

### P2-6 数字滚动 count-up 列了卡库 `{length}张已收藏`,但**集齐里程碑无独立庆祝数字**
- motion-spec §8 count-up 覆盖了完成度/streak/卡库数,但 gamification 的"套系集齐"(3/12→集齐)这个最强情绪点**没有对应的数字/进度动效规格**。
- **动作(P2)**:给 `CollectionMeter` 的套系进度条补 count-up + 集齐时的金色脉冲规格(motion-spec §7/§8 联动)。

---

## 总评

四份草案**技术深度很高、与真实代码贴合度好**(尤其 a11y 和 asset-pipeline 对现有符号的引用精确),但作为一个**协同交付包**存在**三个系统性裂缝**:(1)`legendary` 四档/三档的世界观分裂(P0-1);(2)色彩身份两套互斥色表+撞红涨绿跌(P0-2);(3)参考图3整张被降级为"可选"(P0-3)。这三条不解决,实现 agent 之间会直接死锁或产出割裂的视觉。

**还有一条贯穿性的方向问题**:草案把"活泼/delight"几乎全押在**揭晓后的奖励特效**(confetti/foil/光带),却**漏掉了盲盒最核心的"拆"的物理瞬间**(P1-2)和**收集货架本身的逛感**(P0-3)。参考图的活泼是"开盒+逛架+集齐"的**全流程**,不是结尾放烟花。建议把delight预算从"奖励特效"前移一部分到"开盒交互"和"画廊浏览"。

**先做**:P0-1/P0-2/P0-3(拍板事实源,1天文档对齐) → P1-1/P1-2(弹窗契约统一 + 开盒物理) → 其余按序。