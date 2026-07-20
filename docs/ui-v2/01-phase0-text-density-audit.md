# UI v2 · Phase 0 全站文字密度审计（2026-07-20）

> 多 agent 并行扫描 22 页真实源码，量化用户可见文案。判定基准：单板块 >240 字=过载，120–240=偏多。
> 处置动作：**删**（冗余直接删）· **折**（Disclosure 默认收起）· **移**（移到子页/弹层）· **图形化**（换图片/图标/数字卡）· **保留**（功能性内容附收敛备注）。
> 统计：**70 个待处理板块**（折 34 / 删 21 / 图形化 9 / 移 1 / 保留 5），执行时逐条落地并保 a11y/E2E 全绿。

## `/student`（标记 10 板块 · ~2880 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 多元理财学习版图（Finance Map 四组卡+16张子服务卡）<br><sub>src/components/student/student-home-hub.tsx:369</sub> | 640 | 过载 | **折** | 组导语（~60字）与每组 summary/concept/completionLabel 叠加，子卡还各带一句 learn 文案；子卡只留标题+状态徽标，learn 移入 hover/展开，组 summary 删到一句 12 字内 |
| AI 配置中枢（实时配置面板+教练评语+再平衡建议）<br><sub>src/components/student/student-allocation-panel.tsx:269</sub> | 520 | 过载 | **折** | coachNote/marketNote 两大段 AI 解说 + 4 张行情信号卡 summary + 3 条建议 detail 同屏；教练评语默认只显首句，整段折进「查看完整点评」；行情信号 summary 删 |
| 回合事件+决策卡+自适应教练提醒<br><sub>src/components/student/student-sandbox.tsx:493</sub> | 330 | 过载 | **折** | event.description(~60)+coachingCue(~40)+决策选项 detail+最多2条自适应事件(title/message/teachingPoint 各三行)；coachingCue 与 teachingPoint 默认收起为「💡提示」可展开，事件描述保一句 |
| 实时导师点评+AI 决策雷达（含投资人格卡）<br><sub>src/components/student/student-tutor-radar.tsx:163</sub> | 300 | 过载 | **折** | lastInsight 段落+雷达 summary+6 维每维一句 note+persona summary 全部铺开；6 维 note 折进各维点击展开，雷达图形本身已承载信息 |
| 市场温度计（沙盘情绪面板）<br><sub>src/components/student/market-thermometer.tsx:133</sub> | 240 | 偏多 | **折** | summary+contrarianHint 两段解说+底部方法论一句（24字）；温度数字/色条已图形化，contrarianHint 折为「逆向提示」展开项，底部方法论句删 |
| 赛季挑战面板（目标清单）<br><sub>src/components/student/student-home-hub.tsx:214</sub> | 200 | 偏多 | **折** | season.summary+每条 objective 的 detail 副行叠加；objective 只留 label+进度数字，detail 收进点击展开 |
| 今日必看（4 张每日任务卡）<br><sub>src/components/student/student-home-hub.tsx:312</sub> | 190 | 偏多 | **删** | 每卡 tag+concept+title+summary+progressLabel+actionLabel 六段文字；summary 与 title 语义重复，直接删 summary，保留标题+进度+动作按钮 |
| 资产卡片网格（6 资产 description）<br><sub>src/components/student/student-sandbox.tsx:626</sub> | 180 | 偏多 | **图形化** | 每卡两行资产介绍文案；换成风险等级图标+类别徽标，介绍移入「询问 AI」路径 |
| 服务台 Hero（今日理财学习服务台+4 域卡）<br><sub>src/components/student/student-home-hub.tsx:159</sub> | 180 | 偏多 | **删** | hero 副标题「像真实理财 App 一样组织信息…」是自我说明可删；4 域卡 summary line-clamp-2 可减到一句关键词 |
| 页头双标题（PlatformLayout h1 + 沙盘内部同名视觉标题）<br><sub>src/components/student/student-sandbox.tsx:414</sub> | 100 | 偏多 | **删** | 「学生策略台」出现两次（外壳 h1 + 面板内 display 标题），沙盘内部 header 面板整块可删或并入 KPI 行 |

## `/`（标记 8 板块 · ~2150 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 8 大模块卡片墙<br><sub>src/app/(site)/page.tsx:104</sub> | 615 | 过载 | **折** | 每卡=等级+标题+32字描述+3个高亮chip+外链文案，8卡叠加超600字；建议卡面只留标题+3个chip，32字描述默认收起或移入hover/详情，段首引导语（约55字）压缩为一句 |
| 页头「产品矩阵」下拉大菜单<br><sub>src/components/site/site-header.tsx:178</sub> | 600 | 过载 | **删** | 左侧70字导语+4组各含26字summary+12个菜单项每项28字描述，纯导航却有600字；菜单项描述整体删除只留label，组summary删或压到10字内 |
| 方案优势对比（传统 vs Brown Zone）<br><sub>src/app/(site)/page.tsx:151</sub> | 195 | 偏多 | **图形化** | 4行×两栏文字段落约170字；改成图标+关键词对比表（每格≤8字），传统课一栏可弱化为灰色小字或直接删 |
| 页脚<br><sub>src/components/site/site-footer.tsx:17</sub> | 165 | 偏多 | **删** | 品牌简介45字与首屏hero副标题重复，删掉；底部65字免责声明属合规文案保留不动；三列链接保留 |
| 移动端导航抽屉·产品矩阵<br><sub>src/components/site/site-header.tsx:299</sub> | 150 | 偏多 | **删** | 4组各26字summary在小屏抽屉里挤占滚动空间，删summary只留组名+chip链接；底部三条卖点图标行保留 |
| 未成年人友好承诺<br><sub>src/app/(site)/page.tsx:233</sub> | 145 | 偏多 | **保留** | 4条去金钱化/无真实交易承诺属合规与信任文案，不硬减；可仅做排版减负（图标前置、行距收紧） |
| 增长路径（三阶段路线图）<br><sub>src/app/(site)/page.tsx:171</sub> | 140 | 偏多 | **图形化** | 三个Phase各25字说明段，改成竖向时间轴：序号+8字关键词，详情放hover或折叠 |
| 团队与愿景<br><sub>src/app/(site)/page.tsx:213</sub> | 140 | 偏多 | **图形化** | 4人各24字职责描述，对访客信息价值低；改头像+姓名+角色chip的紧凑名片，24字summary删或hover展示 |

## `/student/risk-profile`（标记 7 板块 · ~2040 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 6 张情境翻卡（题干+scenario+9段 option detail/卡）<br><sub>src/lib/risk-profile.ts:69</sub> | 810 | 过载 | **保留** | 测评题目本体是功能性内容不硬减；但可折：option 的 detail 副行默认收起、点选后展开 concept 标签 |
| 行为复评结果卡（summary+问卷vs行为+证据+训练）<br><sub>src/components/student/student-risk-profile-dashboard.tsx:669</sub> | 300 | 过载 | **折** | 生成后一次性铺 5 个子块；默认展示 persona 标题+一句 summary+问卷vs行为对比，行为证据/下一步训练收进 Disclosure |
| 卡背引导语（×6重复）<br><sub>src/components/student/student-risk-profile-dashboard.tsx:155</sub> | 240 | 过载 | **删** | 「点击翻开情境卡/先看场景再做选择/每一张卡只考察一个投资概念」每张卡背重复，6 张共 ~240 字；卡背只留「翻开卡片」按钮 |
| Hero 人格结果（archetype+summary+learningConcept）<br><sub>src/lib/risk-profile.ts:263</sub> | 220 | 偏多 | **图形化** | 人格 label+archetype 做成大字卡，summary 保留一句，learningConcept 收进「本次核心概念」折叠项 |
| Mr.Brown 教练（title+summary+3 步建议）<br><sub>src/lib/risk-profile.ts:414</sub> | 180 | 偏多 | **折** | nextSteps 每条 ~30 字，默认展示 1 条其余收起；「这份画像只用于教育模拟…」免责句保留但缩为一行 |
| 雷达维度解释（6×label+hint）<br><sub>src/lib/risk-profile.ts:366</sub> | 150 | 偏多 | **折** | 与雷达图信息重复（图已 aria-hidden 依赖此文本），默认折叠为「查看维度说明」，展开保留全部文本以维持 a11y 等价物 |
| 当前配置 vs 人格区间（3项 hint+双进度条）<br><sub>src/components/student/student-risk-profile-dashboard.tsx:761</sub> | 140 | 偏多 | **图形化** | item.hint 三句删除，双色进度条+「高于/低于 x%」徽章已足够表达 |

## `/student/quests`（标记 8 板块 · ~1800 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 活动权益货架（微练习/小赛事/皮肤等5项）<br><sub>src/lib/quests.ts:215</sub> | 420 | 过载 | **折** | 每项 summary+reward+guardrail 三段解说全铺开；默认只留标题+一行 summary，guardrail 收进 ⓘ 弹层，货架级总 guardrail 只留一条 |
| 任务锦囊主卡+合规免责句群<br><sub>src/components/student/student-quest-dashboard.tsx:1888</sub> | 300 | 过载 | **删** | 「只记录学习轨迹，不改变净值/学习点/学习榜」同页 ≥6 处变体（主卡、领卡横幅、卡库、图鉴、弹窗、活动架）；全页保留 1 处统一声明即可 |
| 任务地图下方6张航线卡（coachNote 重复地图）<br><sub>src/components/student/student-quest-dashboard.tsx:481</sub> | 260 | 过载 | **折** | 地图节点已表达同一信息，卡片砍掉 coachNote 两行文案，只留标题+进度条+状态章，coachNote 移入详情弹层（弹层已存在） |
| 指挥官简报（标题+对话气泡+提示条）<br><sub>src/components/student/student-quest-dashboard.tsx:168</sub> | 200 | 偏多 | **删** | 「任务不会一股脑摊开…」「页面默认只展示关键信息…」与指挥官对话三段互相重复，留对话气泡一段即可 |
| 成就墙（7项 detail+decorativeReward+免责）<br><sub>src/lib/quests.ts:459</sub> | 180 | 偏多 | **折** | 成就卡只留标题+图标，detail/奖励名收进点击展开；页脚免责句并入全页统一声明 |
| 赛季任务卡背引导语（×4重复）<br><sub>src/components/student/quest-dashboard/mission-cards.tsx:241</sub> | 150 | 偏多 | **删** | 「翻开后再查看任务目标、进度和完成入口」每张卡背重复一遍，卡背改纯插画+「翻开」按钮 |
| 卡库/伙伴图鉴 intro+空态<br><sub>src/components/student/quest-dashboard/collection.tsx:114</sub> | 150 | 偏多 | **删** | 卡库 intro、空态、待领取提示三段说明合并为一句；免责句并入全页统一声明 |
| 任务中心 hero（完成度/连续学习/学习进度）<br><sub>src/components/student/student-quest-dashboard.tsx:1289</sub> | 140 | 偏多 | **图形化** | 三张 KPI 卡的解释句改成数字卡+图标，streak 重启引导文案保留（防习得性无助，属功能性） |

## `/student/wealth`（标记 7 板块 · ~1390 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 持有计划复盘表单（4关注项+5动作项全带hint）<br><sub>src/components/student/student-wealth-dashboard.tsx:476</sub> | 330 | 过载 | **折** | 9 个选项每个 label+hint 双行（hint 来自 wealth-review.ts），默认只显示 label，hint 改选中后单条显示或 tooltip；区块 intro「先写计划，再执行动作…」压缩到一句 |
| Mr.Brown Review 侧栏（coach 标题+summary+3步）<br><sub>src/lib/wealth-review.ts:194</sub> | 210 | 偏多 | **折** | nextSteps 3 条默认只展示第 1 条，其余 Disclosure 收起；feedback 反馈句保留（提交后即时反馈属功能） |
| Mr.Brown 建议（coaching+3 nextSteps）<br><sub>src/lib/allocation.ts:280</sub> | 190 | 偏多 | **折** | 三条建议每条约 30 字全铺开，默认展示与当前诊断最相关的 1 条，其余收起 |
| 资产配置环（9 个 slice 的 hint 副文案）<br><sub>src/lib/allocation.ts:78</sub> | 180 | 偏多 | **折** | 环形图旁 9 张小卡每张 label+hint，hint（「应急缓冲，负责给下一回合留下选择权」等）收进 hover/点击 tooltip，只留名称+占比 |
| 多元理财地图（3 zone summary+配置vs建议区间）<br><sub>src/components/student/student-wealth-dashboard.tsx:356</sub> | 170 | 偏多 | **图形化** | zone summary 三句删掉改用图标+占比数字卡；「高于/低于建议 x%」保留（数据标签） |
| 持有总入口 Gateway（intro+4卡 summary）<br><sub>src/components/student/student-wealth-dashboard.tsx:339</sub> | 160 | 偏多 | **删** | 「参考理财 App 的持有页心智…不引导真实买卖」这句产品自述删除，4 张入口卡 summary 保留（导航功能性） |
| Hero 财富总入口（标题+简介+KPI 副句）<br><sub>src/components/student/student-wealth-dashboard.tsx:214</sub> | 150 | 偏多 | **删** | 「把现金、储蓄、股票…放到一张地图里」与「风险不是敌人失控才是」「用回合趋势看节奏…」三段鸡汤副句删至一句主简介 |

## `/student/market`（标记 7 板块 · ~1350 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 选中标的主面板（K线速写+图注解说+复盘任务片）<br><sub>src/components/student/student-market-board.tsx:1139</sub> | 280 | 过载 | **折** | klineSummary 自动生成图注（~110字）+「实体看多空拉扯…」方法提示+A股配色括注+3 个任务 chip 全铺开；图注默认收起为「图表解读」展开项，方法提示删（任务 chip 已表达）；「教学示意·非真实行情」来源徽标为合规文案保留 |
| 6维教学观察雷达（雷达图注+6 维说明卡）<br><sub>src/components/student/student-market-board.tsx:1262</sub> | 250 | 过载 | **折** | radarSummary（~70字）+每维 note 一句共 6 句；雷达图已图形化，6 维 note 折成点击单维展开，radarSummary 只保「最强/最弱」一句 |
| 我的自选观察（观察卡 reason+记录框引导语）<br><sub>src/components/student/student-market-board.tsx:851</sub> | 220 | 偏多 | **折** | 面板导语+每卡 reason 全文+深色记录框「当前：…仅美股开放…」提示；reason 默认 line-clamp-1 点开全文，空态引导保一句 |
| 同学热度（headline+summary+每条 coachNote）<br><sub>src/components/student/student-market-board.tsx:1378</sub> | 200 | 偏多 | **折** | 深色框 headline+summary 两段 + 4 条目各带 concept·coachNote 解说；coachNote 折叠，headline/summary 合并为一句；底部 privacyNote 属合规文案保留 |
| 课堂提示（observationNotes 列表）<br><sub>src/components/student/student-market-board.tsx:1487</sub> | 140 | 偏多 | **折** | 3-4 条整句教学提示同时铺开；默认展示 1 条+「更多提示」展开 |
| 资讯内容卡（3 张 title+summary）<br><sub>src/components/student/student-market-board.tsx:1502</sub> | 130 | 偏多 | **折** | 副卡 summary 折为 line-clamp-1，点开阅读 |
| 观察池结构拆解（甜甜圈+sectorSummary）<br><sub>src/components/student/student-market-board.tsx:1328</sub> | 130 | 偏多 | **删** | sectorSummary 整句复述了图和列表已表达的最强/最弱板块，直接删（保留 aria 层给读屏） |

## `/student/history`（标记 4 板块 · ~1130 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| Mr.Brown 历史复盘建议（AI 总结+诊断分析+下一步建议）<br><sub>src/components/student/student-history-review-dashboard.tsx:691</sub> | 500 | 过载 | **折** | AI summary 大段+诊断 3 条+下一步 3 条全部铺开，是全页最大文字块；总结常显，诊断/下一步做成两个默认收起的 Disclosure（复盘核心内容不删只折） |
| 历史操作速写（6 统计块+橙色方法论框+学习信号面板）<br><sub>src/components/student/student-history-review-dashboard.tsx:501</sub> | 270 | 过载 | **删** | 橙色框「当前历史页默认按回合趋势优先组织…」和学习信号导语「机会观察…不会直接改变收益…」是口播式自我说明，直接删；每类信号 detail 折叠，统计块保留 |
| 复盘 Hero+4 张回合亮点卡<br><sub>src/components/student/student-history-review-dashboard.tsx:438</sub> | 210 | 偏多 | **折** | hero 导语一句可保，4 张 highlight 卡 title+detail+metric 三层，detail 折为点击展开，卡面留 R 标+指标数字 |
| 回合表现可视化（3 图各带副标题解说）<br><sub>src/components/student/student-history-review-dashboard.tsx:572</sub> | 150 | 偏多 | **删** | ChartShell description+每图「先看…再…」解说一共 4 句方法论；图内解说各删至 0-1 句，图例保留（1.4.1 线型冗余是 a11y 必需，不动） |

## `/learn`（标记 2 板块 · ~810 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 课程模块卡 ×8（课程矩阵网格）<br><sub>src/components/site/learn-catalog.tsx:224</sub> | 580 | 过载 | **删** | 文案源在 src/lib/content.ts learningModuleDefinitions（L203 起）。每卡 description ~30-40 字 ×8 ≈ 260 字是主负担：卡面砍成 ≤14 字一句话（可直接用更短的 tagline 截句），highlights 胶囊保留；完整 description 移入悬停/详情不必新增页面 |
| 课后小测弹窗（说明+题目）<br><sub>src/components/site/learn-catalog.tsx:290</sub> | 230 | 偏多 | **保留** | 题目与选项是功能性学习内容不减；仅头部解说「答对 80 分…不是点击刷分」可从 38 字压到一句 ≤16 字 |

## `/student/life`（标记 5 板块 · ~800 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 4 周生活账本训练（4×title+budget+checkpoint）<br><sub>src/lib/life-cashflow.ts:235</sub> | 190 | 偏多 | **移** | 四张周卡各带 checkpoint 解说，整块移到「开始训练」弹层/子步骤，主页只留一张进度条卡 |
| 预算策略 3 卡（tagline+concept 双段）<br><sub>src/lib/life-cashflow.ts:116</sub> | 170 | 偏多 | **折** | 每卡 title+tagline+concept 三层；concept（「预算不是限制自由…」）收进选中态才显示 |
| Hero 现金流实验室（简介+4 KPI hint）<br><sub>src/components/student/student-life-cashflow-dashboard.tsx:165</sub> | 170 | 偏多 | **图形化** | 4 张 KPI 卡的 hint 副句删除改纯数字卡+图标；主简介两句压成一句 |
| 突发事件压力测试（3事件 teachingPoint）<br><sub>src/lib/life-cashflow.ts:189</sub> | 140 | 偏多 | **折** | teachingPoint 每条 ~25 字默认收起，点击事件卡展开；覆盖/自付数字卡保留 |
| 保险方案（summary+3 option concept）<br><sub>src/components/student/student-life-cashflow-dashboard.tsx:390</sub> | 130 | 偏多 | **折** | option.concept 副句收进选中态；insurance.summary 保留一句 |

## `/pricing`（标记 3 板块 · ~705 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 定价卡 ×4（描述+功能清单）<br><sub>src/app/(site)/pricing/page.tsx:126</sub> | 400 | 过载 | **折** | 四卡并排一屏共 ~400 字。功能清单是购买决策信息不硬删，但：每卡 description（25-31 字）压到 ≤12 字定位句；学校授权 8 条、标准/高级 6 条默认显示前 4 条其余 Disclosure 展开；「标准版全部能力」类继承句保留作首条 |
| FAQ 常见问题 ×3<br><sub>src/app/(site)/pricing/page.tsx:200</sub> | 165 | 偏多 | **折** | 改为 Disclosure 手风琴：默认只显示 3 个问题（~35 字），答案点开展开 |
| 学生/家长开通引导内嵌提示（条件渲染）<br><sub>src/app/(site)/pricing/page.tsx:165</sub> | 140 | 偏多 | **保留** | 未成年人付款合规解释文案（学生端不发起付款/确认链接用途），属合规必要说明，且两块互斥同屏最多出现一块（~70 字） |

## `/student/auto-invest`（标记 3 板块 · ~550 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| Mr.Brown 训练提示（summary+概念chips+3 STEP）<br><sub>src/components/student/student-auto-invest-dashboard.tsx:632</sub> | 220 | 偏多 | **折** | coach.summary+3 条 nextSteps 全铺开；默认 summary 一句+STEP 1，其余 Disclosure |
| Hero 定投机器人（简介+标的 description）<br><sub>src/components/student/student-auto-invest-dashboard.tsx:184</sub> | 170 | 偏多 | **删** | 「学生练的不是猜最低点…」简介压缩一半；右栏标的 description 收进 tooltip，只留名称+现价+涨跌 |
| 执行轨迹（intro+最近3节点 note）<br><sub>src/components/student/student-auto-invest-dashboard.tsx:489</sub> | 160 | 偏多 | **折** | 「机器人按回合拆单，重点不是每次都赚钱…」intro 删半；每个节点的 note 解说折进节点展开 |

## `/admin`（标记 2 板块 · ~520 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 微信收款码配置卡<br><sub>src/components/admin/manual-wechat-config-card.tsx:100</sub> | 350 | 过载 | **折** | admin 里唯一真过载：85 字路线导语+5 条就绪检查详情(~110 字)+4 步「上线前验证路径」(~112 字)同屏堆叠；把验证路径 ol 和导语折进「查看上线指引」Disclosure，就绪徽章/表单字段/下一步告警保留 |
| 顶部 hero（双轨商业模式+当前身份）<br><sub>src/app/(platform)/admin/page.tsx:41</sub> | 170 | 偏多 | **删** | 68 字「双轨商业模式」段落是对着管理员念的营销词，删至一句；当前身份卡 45 字权限说明保留（功能性） |

## `/student/credit`（标记 2 板块 · ~310 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| Mr.Brown 侧栏（coach summary+3步）<br><sub>src/components/student/student-credit-lab-dashboard.tsx:158</sub> | 180 | 偏多 | **折** | 3 条 nextSteps 默认展示 1 条；summary 保留 |
| Hero（标题+简介+3 KPI）<br><sub>src/components/student/student-credit-lab-dashboard.tsx:124</sub> | 130 | 偏多 | **删** | 简介两句砍成一句「借款会增加现金也同步增加债务」，「先算清利息再决定要不要借」标题已承载主旨 |

## `/demo`（标记 1 板块 · ~135 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 页面 Hero（标题+三分号长句+3 提示胶囊）<br><sub>src/app/(site)/demo/page.tsx:18</sub> | 135 | 偏多 | **删** | 75 字长句（新用户…已有账号…游客…邀请码…）与下方 Access Center 三张入口卡逐一重复：删到一句 ≤20 字总述；3 个胶囊可换图标+短语 |

## `/parent`（标记 1 板块 · ~135 字）

| 板块 | 字数 | 判定 | 动作 | 处置 |
| --- | ---: | --- | --- | --- |
| 家庭组管理（家庭高级版）<br><sub>src/components/parent/family-manager.tsx:153</sub> | 135 | 偏多 | **保留** | 开通说明 60 字+空态引导 50 字是计费/绑定引导的功能文案，PIPL 场景不宜删；最多把权益列举改成 3 个图标+短词 |

