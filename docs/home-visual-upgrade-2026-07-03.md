# 学生主页视觉升级开发文档（2026-07-03）

> 需求来源：用户内测反馈四则 + AI 网关变更通知。本文档覆盖 需求 → 设计 → 实现 → 验证 → 使用。

## 一、需求与问题清单

| # | 用户反馈 | 定性 |
| --- | --- | --- |
| 1 | 学生主页个人形象应为 3D 卡通形象，可在 20+ 可爱形象中随机/自选切换 | 新功能 |
| 2 | 竖向文本框过于狭窄（NEXT QUEST 一行一字），显示不美观 | 布局缺陷 |
| 3 | 界面文字过多，应精简：关键文字保留，细节转点击查看，充分留白 | 信息密度 |
| 4 | 「服务九宫格」文字过多，改为配套卡通图标 + 关键简约文字 | 信息密度 |
| 5 | 手机/平板自适应，保证移动端正常美观显示 | 响应式 |
| 6 | AI 网关维护恢复，国内推荐主线换 `https://api.llm-token.cn/v1`（延迟更低） | 配置迁移 |

## 二、根因分析（问题 2 为何一行一字）

萌宠面板外层为固定三栏 `xl:grid-cols-[330px_minmax(0,1fr)_390px]`。在 1440px 视口下内容区约 978px，左右两栏共吃掉 720px，**中列只剩 258px**；其内旧双栏 `minmax(0,1fr)_minmax(260px,0.75fr)` 中右栏强制 260px 下限直接溢出，把 Next Quest 栏挤压到近 0 宽 → 中文逐字换行。

结论：这是**视口媒体查询（xl=1280 视口）≠ 面板实际宽度**的经典错配，根治手段是 CSS 容器查询（Tailwind v4 原生支持）。

## 三、方案设计

### 3.1 三档容器查询布局（`student-pet-reward-studio.tsx`）

面板根 `<section>` 声明命名容器 `@container/petstudio`，外层网格按**面板自身宽度**分级：

| 面板宽度 | 布局 |
| --- | --- |
| < 56rem (896px) | 全部纵排（原移动行为） |
| ≥ 56rem | 双栏：形象 320px + 内容 1fr；奖励区 `col-span-2` 横跨底部 |
| ≥ 80rem (1280px) | 恢复三栏 330px / 1fr / 390px |

中列另设未命名 `@container`，其内 Next Quest / 成长轨迹 仅当**中列自身 ≥ 44rem** 才双栏（`@[44rem]:grid-cols-2`），未命名查询就近匹配中列容器，与外层命名容器互不干扰。

实测（1440 视口）：中列 258px → **658px**，Next Quest 面板 610px 全宽。

### 3.2 23 选 3D 形象切换系统

- **形象库** `AVATAR_GALLERY`（23 项）：`default` 手绘布朗小栗 SVG + 12 只 quest-world 任务角色（复用 `public/brand/quest-world/characters/*.webp`）+ 10 只新生成萌宠（`public/brand/pet-avatars/pet-*.webp`）。
- **新资产管线** `scripts/gen-pet-avatars.mjs`：gpt-image-2（经 `api.llm-token.cn/v1/images/generations`）→ PNG(b64) → sharp → 512px webp q82，单张 12–20KB，共 10 张全部成功。
- **交互**：形象下方「切换形象」（弹窗网格 23 选，`useModalA11y` 焦点陷阱 + Esc + 滚动锁 + 焦点归还）与「随机」（等概率换一只，排除当前）。
- **持久化**：`localStorage["brown-zone-pet-avatar-{petId}"]`；**SSR 恒渲染默认形象，挂载后 useEffect 读取换装** → 服务端/客户端首帧一致，水合安全。
- 装饰奖励轨道（`data-reward-orbit`）与光斑装饰在图片形象下保留（加 `backdrop-blur` 保证可读）。

### 3.3 减字（问题 3）

- **教练详评**：原常显长段落收进 `<details>`「教练详评」，标题与心情徽章保留。
- **成长轨迹**：5 里程碑常显「最近 2 个已解锁 + 下一个目标」，其余收进 `<details>`「查看全部 N 个里程碑」。
- 原生 `details/summary`：零 JS、键盘可达、读屏友好。

### 3.4 九宫格图标化（问题 4）

12 服务 ↔ 12 只 quest-world 角色语义配对（市场雷达↔市场小狐、任务中心↔裁判小狮……），卡片精简为 **56px 圆角图标 + 标题 + ≤10 字关键词**：

- 原 `summary` + 「你会学到」长文 → `aria-label` 与 `title`（悬停 tooltip / 读屏完整可得，视觉隐藏）。
- `status="ready"` 徽章省略（减噪），仅「新增/订阅」显示。
- 卡高 ~168px → **72px**，首屏信息密度显著下降，留白增加。

### 3.5 AI 网关迁移（问题 6）

| 位置 | 变更 |
| --- | --- |
| `.env.local`（本机，不入库） | `AI_BASE_URL_PRIMARY=https://api.llm-token.cn/v1`，旧 `gpt-agent.cc/v1` 转 SECONDARY 备线 |
| `scripts/gen-market-images.mjs` | ENDPOINTS 主线换 llm-token，旧入口作跨域备线 |
| `scripts/gen-mascot-samples.mjs` / 新 `gen-pet-avatars.mjs` | 直接使用 llm-token |
| `docs/VERCEL-ENV.md` / `docs/ENV-CHECKLIST.md` / `教师电脑本地迁移使用说明.txt` | 推荐值同步 |

聊天网关本身经 `src/lib/ai.ts` 读 env，无代码改动；主挂自动 fallback 到备线。

## 四、验证记录

| 层 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | ✅ 零错误 |
| `npm run lint` | ✅ 零警告 |
| `npm run test` | ✅ 95 文件 / 634 用例全绿 |
| `npm run build` | ✅ 生产构建成功 |
| 实机 DOM（dev :3100，真实登录态） | 中列 258→658px；23 选弹窗全渲染；选中即换/随机/刷新持久化（stored=penguin → 渲染 penguin）闭环实证 |
| 响应式 | 375 / 768 / 1440 三档 `document.scrollWidth - innerWidth ≤ 0`（零横向溢出）；375 单列、768 九宫格 2 列、1440 双栏+奖励横跨 |
| 多 agent 审查轮 | 4 维（正确性/无障碍/响应式/回归）并行审查 + 逐条对抗验证，结论见 §五 |

## 五、多 agent 审查结论（16 agents · 4 维审查 + 逐条对抗验证 · 145 万 tokens）

审查工作流 `home-visual-upgrade-review`：正确性 / 无障碍 / 响应式 / 回归 4 维并行审查首轮实现，每条发现由独立对抗验证员证伪核查（含重编译 Tailwind 产物、node 实测 GSAP 行为、平台布局宽度链算术）。确认 7 条，**全部当轮修复并复验**：

| 级 | 发现 | 修复 |
| --- | --- | --- |
| P1 | 形象弹窗 `fixed` 被面板根新加的 `@container`（container-type 的 layout containment）+ GSAP 残留 transform 改写包含块：遮罩只盖面板、被 `overflow-hidden` 裁剪，移动端底部抽屉锚到面板底缘（视口外）且滚动已锁 | `createPortal(document.body)` 渲染弹窗；375px 实测六项全过（portal ✓ 遮罩全屏 ✓ 抽屉贴底 ✓ 初焦点=关闭键 ✓ Esc ✓） |
| P2 | `@[80rem]` 三栏档死代码：平台 `max-w-screen-2xl` 宽度链下面板全场景最大 1215px < 1280px，三栏永不触发 | 阈值降至 `@[70rem]`（1120px），2xl 面板恒 1148px → 三栏真实可达 |
| P3 | 1280–1347px 视口布局倒挂（xl 侧栏出现瞬间面板 828–895px < 56rem 回落全纵排，比更窄视口还挤） | 双栏阈值降至 `@[50rem]`；1280×800 实测双栏 320/498 |
| P3 | 奖励图鉴横跨模式下奖励卡被拉至 ~1100px 宽 | 图鉴列表横跨档 2 列、三栏档回 1 列 |
| P3 | 服务卡 `title`+`aria-label` 内容重叠 → 读屏 name+description 双重播报；且触屏无 hover，title 无意义 | 移除 title，全文案由 aria-label 单通道承载 |
| P3 | 「新增/订阅」徽章被 aria-label 覆盖后读屏不可知 | 状态词并入 aria-label（`市场雷达（策略行动·新增）：…`） |
| P3 | 弹窗焦点陷阱初焦点落在 tabIndex=-1 容器上，首个 Shift+Tab 可逃出；两处 `<summary>` 触控高 36px | 初焦点指定关闭按钮（`useModalA11y` 第三参）；summary 升至 40px |

另确认 1 条工程卫生（home-hub import 段被 const 截断）已归位修复；1 条流程风险（10 张新头像资产未跟踪，漏提交则线上 404）在提交环节以显式路径加入同一 commit 消除。

复验基线：tsc ✓ / lint 0 警告 / vitest 95 文件 634 用例 ✓ / build 61 页 ✓ / 375·768·1280·1440 四档实机几何复测 ✓。

## 六、使用说明

- **切换形象**：学生主页 → 萌宠面板 → 形象下「切换形象」打开 23 选网格，或「随机」一键换。选择仅影响本机展示（localStorage），不涉及任何数据库写入与付费/稀有度机制（防射幸合规红线维持）。
- **重新生成萌宠素材**：`AI_API_KEY=$(grep '^AI_API_KEY=' .env.local | cut -d= -f2) node scripts/gen-pet-avatars.mjs`（幂等，已存在的图会被覆盖）。
- **九宫格完整介绍文本**：悬停卡片（title tooltip）或读屏（aria-label）可获得原 summary + 你会学到 全文。

## 七、涉改文件

```
src/components/student/student-home-hub.tsx        九宫格图标化 + 减字
src/components/student/student-pet-reward-studio.tsx 容器查询布局 + 形象系统 + 减字
scripts/gen-pet-avatars.mjs                        新增：萌宠素材管线
scripts/gen-market-images.mjs                      网关主线迁移
scripts/gen-mascot-samples.mjs                     网关迁移
docs/VERCEL-ENV.md                                 推荐网关说明
教师电脑本地迁移使用说明.txt                        env 模板更新
public/brand/pet-avatars/*.webp                    新增：10 张 3D 萌宠（12–20KB/张）
```
