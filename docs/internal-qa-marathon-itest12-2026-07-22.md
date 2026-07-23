# itest12 · 上线冲刺轮（2026-07-22）

> 范围：`feat/student-ui-v3` 上线前终检 + 商业闭环真交互 + 界面全检 + 品牌产品化。
> 方法：监工契约（Opus 派工 + 四件套「首动令/证读令/产物令/验收令」+ 回执三查）驱动多 agent 工作流。
> 提交链：`fb1e704 → 065751f → ae938ee`。

## 1. 确定性基线（修复前，全绿）

| 项 | 结果 |
| --- | --- |
| tsc / lint | 0 / 0 |
| vitest | 736/736 |
| build | 0 错误 |

## 2. P0 · AI 气泡疑云闭环

- 组件本身无恙；根因＝面板探针 `networkidle` 在 `/student` 被行情后台请求撑住 12s+，吃掉气泡 8–12s 首演窗口。
- 探针改 `waitUntil:"load"` + 等待式断言后 **7/7 PASS**。
- KeyAI 面板同画风升级 + 标语气泡入库。

## 3. P1 · 商业闭环真交互探针（终态 21/21 PASS）

`scripts/itest12-commerce-probe.mjs`（352 行，手工 cookie 回放）。抓修 2 真缺陷：

| # | 级 | 缺陷 | 修复 |
| --- | --- | --- | --- |
| 1 | P1 | 邀请码注册不写 `trialExpiresAt`（对比邮箱注册 3 天试用不对称）→ 新生首笔交易 403「试用已结束」 | repo + store 双路径补齐 + 2 对称性用例 |
| 2 | P2 | AI 网关把 `<think>` 思维链透传给学生 | `requestRemoteText` 加 `stripThinkBlocks`，7 出口全覆盖 + 8 用例 |

附实测：人工收款 9 步闭环全通（超管配置→建单→凭证→确认→学生 premium+active）；学生本人自付被拒 403（未成年护栏）；AI 真调用 `provider=remote` 回复 227 字非降级；登录限流真实阈值＝每账号 12 次失败、第 13 次 429。

## 4. P2 · 界面全检（50 agent：22 页实拍 → 三维审 → 逐条证伪）

三维＝文字密度三轮 / 一致性 / 大厂对标。**43 确认 / 3 击杀 → 36 small 全落地**（三路并行）：

- 角色端 7 · 学生仪表盘 17 · 沙盘壳层 14。
- 含：删沙盘重复页头、九宫格 xl 收纳、「首页」卡改推进锚点、coach 面板统一 credit-lab 折叠模式、market 重复卡删除、CTA/徽章/字阶 token 化、移动 KPI 双列。
- **5 medium 入 backlog**：深色底统一 / 圆角统一 / history 图表色映射 / 双榜合并 / rank 空态图文卡。

## 5. 页脚品牌产品化（用户钦定）

- 署名：成都市树德实验高级中学·学生创业团队出品；邮箱 `nuoyanoo@163.com`（含 pricing `mailto`）。
- 去「演示级 / 计划书 Demo」；产品宣言「让每一间教室都能拥有自己的经济沙盘」。
- 法律护栏零丢失；全站三串零残留（线上渲染四项 True 实测）。

## 6. 终态复验（全绿）

- build 0；三探针 panel **7/7** · commerce **21/21** · api **34/34**。
- **vitest 746/746**。
- E2E 45 过 + 1 已知 `autoinvest` 基建抖动（隔离 100%，与 itest11 档案同签名——测试基建债，非产品回归）。

## 7. P4 · 上线进展 + 待用户

已办：
- Supabase 项目 Restore（`ACTIVE_HEALTHY`）→ 远端迁移 0013–0022 补齐（台账 13→23，四新表在位）→ RLS 策略已应用。
- Vercel Git 重连成功（Connected，`SevenTeenBoy17/stu-company`）。

待用户执行：
1. Vercel 环境变量更新 `AI_API_KEY`（建议同补 `SUPERADMIN_EMAILS`）。
2. 合并 PR #20 → #21 转 base 合并 → 自动部署 → 生产冒烟。
