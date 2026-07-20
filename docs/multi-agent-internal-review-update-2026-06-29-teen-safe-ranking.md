# Brown Zone 多 Agent 内测补充记录：青少年友好化排名压力清理

## 本轮目标

继续沿着内部教育游戏公司级内测目标推进，优先处理上一轮审阅代理指出的 P1 问题：学生端排行榜、分享卡和风险测评中残留的强竞技语言，可能让 14-19 岁学生把学习反馈误解成“冲榜/守榜/反超”的压力任务。

## 代理/技能分工

- 体验审阅代理结论：排行榜、分享卡和风险测评里仍残留“冲榜/守榜/挤进/高排名/战力”等容易把学习任务转成纯竞技压力的词。
- 产品设计审阅原则：保留同伴反馈与成长记录，但把表达从“打败别人”改为“复盘质量、学习记录、成长区间”。
- 代码审阅降级：CodeRabbit CLI 未安装，按技能说明尝试安装但 124 秒超时；本轮改用 `code_review_graph` 完成审阅门禁。

## 已处理内容

- `src/components/student/season-leaderboard.tsx`：前三名提示改成“复盘表现稳定 / 学习记录进入前列”，去掉“守住”“挤进”。
- `src/components/student/rank/power-card.tsx`：分享按钮、主指标、区间进度和满级提示统一改成“学习记录 / 学习点 / 学习区间”。
- `src/lib/leaderboard/share.ts`：分享文案改成“生成学习记录 / 财商学习画像”，不再鼓励“冲段位”。
- `src/lib/risk-profile.ts`：风险测评中的同伴压力题改成“短期表现亮眼”，成长型画像改成“进取探索”。
- `src/lib/content.ts`：课程测验选项“只截图最高排名”改为“只截图最好结果”。
- 测试与注释：同步清理测试标签、测试输入和内部注释里的强竞技词，降低后续 grep 误报。

## 验证证据

- `rg -n "财商战力|王座|超越|比拼|冲到榜首|冲榜|高排名|排名反馈|目标冲段位|守住到|挤进|最高排名|最高段位" src/components/student src/lib tests/e2e src/app/api` -> `NO_MATCH`
- `npm test -- src/lib/leaderboard/share.test.ts src/lib/risk-profile.test.ts src/lib/behavior-persona.test.ts src/lib/api-response.test.ts` -> 4 files / 39 tests passed
- `npx tsc --noEmit --pretty false` -> PASS
- `npm run lint` -> PASS
- `npm run build` -> PASS
- `python -m code_review_graph update && python -m code_review_graph detect-changes --brief --base HEAD` -> risk score 0.00

## 下一轮建议

- 继续处理 reduced-motion：重点检查 `src/components/student/rank/power-card.tsx` 中点击作用域后滚动行为是否尊重 `prefers-reduced-motion`。
- 继续处理图表可访问性：给市场页 K 线、雷达图、趋势图补等价文本摘要。
- 继续处理奖励命名：把宠物奖励里的“稀有/史诗”等抽卡刺激词改成“主题/套系/纪念”。
