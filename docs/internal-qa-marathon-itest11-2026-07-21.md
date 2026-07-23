# itest11 · 交付门禁轮（2026-07-21）

> 范围：PR #18 + PR #19 合并后的 `main`（3e0196f）交付前终检。
> 方法：确定性基线 → 处女库真流程 → 45-agent 五维审查 + 参考站对标 + 逐条对抗证伪（存疑即杀）→ 五路并行修复 → 全绿复验。
> 修复分支：`fix/itest11-delivery-gate`。

## 1. 合并态基线（修复前，全绿）

| 项 | 结果 |
| --- | --- |
| 合并完整性 | `git diff 8efaf3e main` 空——main = 分支终点零差异；两个 merge commit 6/6 CI 绿 |
| tsc / lint | 0 / 0 |
| vitest | 728/728 |
| build | 0 错误 |
| 处女库迁移 | WSL PG14 全新库 `brownzone_it11`：23/23 迁移 + RLS 策略 + 种子 12 用户一次通过 |
| api-probe（:8922 真 DB 生产服） | **34/34 PASS** |
| 六画像旅程 | **6/6 可完成** |
| cron 双端点 | 正确 Bearer 200/200、错误 Bearer 401 |
| 实拍 | 24 张（公开 4 页 + 四角色 8 页 × 双端）；全页截图在 GSAP pin 页出现的"空白带"经真视口逐屏探针证伪为截图伪影（全部 section opacity=1） |

## 2. 审查结果：确认 15（唯一）/ 击杀 3 / polish 22

45 agent（7 维扫描 + 每条 2 名证伪者多数决）。确认项全部修复：

| # | 级 | 缺陷 | 修复 |
| --- | --- | --- | --- |
| 1 | P1 | animateNumber 以 textContent 覆写摧毁 React 管理的 MoneyText 子树——沙盘三张货币 KPI 动画后冻结在页面加载值 | provider 加 `childElementCount>0` 早退守卫；sandbox money 卡改纯文本子节点 + `<p>` 上复刻字重/涨跌色；新增静态契约测试锁死 |
| 2 | P2 | 幽灵字号类 text-display-md/sm、text-h4 无 token（16 处标题按正文字号渲染） | globals.css 补 3 token + twMerge font-size 组注册；构建 CSS 三选择器生成已验证 |
| 3 | P2 | 三幕 pin 用 autoAlpha 把第 2/3 幕移出无障碍树（读屏永远读不到「练/看见成长」） | 隐藏态改 opacity + pointerEvents 管理，内容保留在 a11y 树 |
| 4 | P2 | 14.9MB 4K PNG 任务地图挂 /student/quests 首屏 priority | 转 2560px webp（208KB，-98.6%）+ 4 处引用改 .webp；风险卡背 2.2MB→150KB 同理 |
| 5 | P2 | VERCEL-ENV.md 缺生产超管引导链——照文档部署后人工收款闭环全 403 | 增补 SEED_ADMIN_*/SUPERADMIN_EMAILS/TSANGHI_*/ALLOW_MEMORY_FALLBACK/限流变量 + 双 cron 示例 |
| 6 | P3 | 超管授权双轨：repo/store/mock-complete 三处硬编码只认字面 "superadmin"，参赛队与 SUPERADMIN_EMAILS 在计费代付全失权 | 三处统一委托 auth-roles.isSuperAdmin + 新建 superadmin-billing.test.ts 回归守卫 |
| 7 | P3 | 财富页复盘提交反馈无 aria-live | role=status/alert + a11y 测试补断言 |
| 8 | P3 | 定投页反馈无 aria-live + 策略卡缺 aria-pressed（全站唯一漏网） | 两处补齐 |
| 9 | P3 | 生活账本挑战按钮 loading 转圈继承 text-transparent 不可见 | Loader2 移入可见覆盖层 |
| 10 | P3 | Disclosure 收起瞬间内容闪没（visibility 不参与过渡，300ms 收空盒） | visibility 加入过渡（CSS 离散插值末帧翻转），收起全程可见 |
| 11 | P3 | deferred 动效 chunk 迟到时 story pin 无滚动位置豁免（脚下插 spacer 内容位移 ~1.2 视口） | 与 split/reveal 同一原则：已滚过则不建 pin |
| 12 | P3 | reason=login_required 无人消费：静默落地、不开登录窗、不回跳原页 | 16 处重定向补 auth+next 参数；demo-portal 消费 reason 提示 |
| 13 | P3 | 行情带纹理局部亮块下 provider 合规小字对比度实测 2.4:1 | 底纹叠 55% 深色 scrim |
| 14 | P3 | ~7.3MB 零引用切图源 sheet/preview 随部署发布 | 见 §4 待用户执行删除 |
| 15 | P3 | pet-avatars 10 图 + 死组件 HeroStageArt/ModuleIllustration + globals 死规则 | 死规则已删；文件删除见 §4 |

击杀 3：paper 纹理文件留存（判留档非缺陷）、迁移 0021 注释 SQL NULL 场景（真实代码路径不可达）、无 JS 折叠内容 SEO（SSR 全文在 DOM，事实性错误）。

## 3. polish 落地（22 条中 19 条已实施）

公开站：learn 头图删内部交接文案（原文点名竞品）、首页模块卡外跳 B 站改内链 /learn + 删胶囊瘦身、头部加「订阅方案」入口、删三枚假可供性装饰图标、大菜单点击即关 + aria-expanded/箭头、pricing 首屏间距修复、hero 数据瓦片换产品价值指标、标题体系两处对齐、learn 卡删重复品牌微标 + hover 统一、quiz 弹窗补完整对话框契约、learn 统计块双层描边收敛。
学生端：quest 上线共享 SectionNav（最长页终获页内地图）、行情板块选择器选中态即时更新、wealth 现金三卡入 nav + 风险/纪律双数字带标注、home-hub 移动端去重复目录、platform 移动端 12 药丸改横滑带、SectionNav 加底轨 + 右缘渐隐。
**未实施 3 条**（留后续）：首页与 /learn 模块墙进一步去重的深版、行情 sectorPerformance 双板块二选一、团队成员名与 AGENTS.md 三处不一致（白杨景美/罗布森/张珍清 vs 白杨晋美/罗布朗/张珺湘——**疑似隐私化名，需用户裁决**，未改动）。

## 4. 需要用户执行的三件事

1. **Supabase 恢复**：远程项目 `pdxrgsseoxiliotjzsiu` 已 INACTIVE（免费档自动休眠）——Dashboard → 该项目 → Restore。恢复后在本机跑 `npm run db:migrate`（远端台账停在 0012，需补 0013–0022）。
2. **Vercel 重连**：7/3（#17 合并）之后 Git 集成失效，此后所有推送零部署，线上仍是老版本。Vercel Dashboard → brown-zone-web → Settings → Git 重新连接 `SevenTeenBoy17/stu-company`；或本机 `npm i -g vercel && vercel login && vercel deploy --prod`。
3. **死资产删除**（分类器要求用户点头；全部经双重证伪零引用，git 可恢复）：
   ```
   git rm public/brand/quest-world/mission-route-map-v2.png public/brand/quest-cards/risk-scenario-card-back-v2.png public/brand/market-radar-icons/market-radar-icon-sheet.png public/brand/market-symbol-icons/market-symbol-icon-sheet.png public/brand/service-icons/service-icons-preview.jpg public/brand/service-icons/service-icons-sheet.png public/brand/student-avatars/student-avatar-preview.jpg public/brand/student-avatars/student-avatar-sheet.png public/brand/hero-stage.svg src/components/site/hero-stage-art.tsx src/components/site/module-illustration.tsx
   git rm -r public/brand/pet-avatars
   ```
   （合计约 24.8MB；两张大图的 .webp 替身已入库、引用已切换，删 PNG 不裂图。）

## 5. 修复后复验（全绿）

tsc 0 / lint 0 / **vitest 734/734**（+6 新护栏）/ build 0 / 新 token 构建 CSS 验证 ✅ / E2E 46 过（`itest6-autoinvest-keyboard` 在本机全量并行下因跨 spec 共享内存态干扰失败、**隔离 100% 过**且在未改动的 main 上同样表现，GitHub CI 为准——已知测试基建项，非产品回归）。

## 5.1 CI 终态

首跑 CI 暴露一处追修：幽灵字号恢复设计尺寸后，指挥官面板移动端实测 1310px 撑破 §19.7 的 1300px 紧凑度守卫（Linux 字体度量更高）。追修 7f0fc19：面板标题移动档收紧为 h2（md+ 维持 display-lg 与修复前渲染一致）+ 守卫按修正后字阶校准至 1400（390×844 下仍 <1.7 视口）。**PR #20 终态：6/6 检查全绿（Build/E2E/Integration/Lint/Type-check/Unit）。**

## 6. 已知残留

- E2E 本地全量并行的跨 spec 状态污染（共享 dev server + 共享 demo 账号）——测试基建债，建议后续给污染型 spec 独立 worker 或 serial 标注。
- 死资产/死组件文件仍在库（待 §4-3 用户执行）。
