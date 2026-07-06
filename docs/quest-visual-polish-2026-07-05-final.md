# 任务中心视觉与交互升级记录（2026-07-05 / 2026-07-06 补充）

## 本轮目标

围绕学生端 `/student/quests` 的任务地图、任务锦囊栏、任务队列、伙伴图鉴、成就墙、我的卡库和活动权益区域做视觉与交互收口。重点解决：

- 任务锦囊卡背和翻转后的卡面不够精致、信息层级不够游戏化。
- 移动端快速导航在滚动到任务锦囊栏时可能遮挡卡片顶部。
- 任务队列下方留白明显、信息密度不均。
- 未解锁的伙伴图鉴和成就墙图标过于清晰，缺少锁定状态。
- 我的卡库空状态过于朴素，不像游戏化学习资产。

## 已完成改动

- 任务锦囊卡背改为更明亮温暖的路线卡视觉：保留角色头像，增加星形航线、琥珀光晕、青绿色路线和更清晰的进度表达。
- 任务卡翻转后改为“航线通行证”结构：顶部深色任务身份区，中部目标/奖励卡片，下方学习收藏卡提示和领取按钮。
- 修复翻转卡片命中区域：隐藏面不再拦截点击，正面的“翻回卡背”“查看任务详情”“领取学习卡”等按钮保持可操作。
- 移动端快速导航从 sticky 覆盖式改为正常文档流展示，避免遮挡卡片顶部。
- 任务队列增加统计、四步流程和 `Next Move` 引导，减少底部空白。
- 未解锁伙伴和成就图标使用灰度、模糊、低透明度与遮罩处理，锁定状态更明确。
- 我的卡库空状态升级为卡牌图案 + 简短说明 + CTA 的横向卡片布局。

## GPT 生图使用说明

- 本轮按需求调用 GPT 图像生成探索任务卡视觉方向。
- 生成结果含有不合适的英文文本和不匹配的题材元素，不适合直接进入中文教育金融产品界面。
- 最终实现采用“已有品牌资产 + 可控 SVG / CSS 渐变 + HTML 中文文本”的方案，保证文字可访问、可维护、可本地化。

## 视觉证据

- 任务锦囊卡背聚焦：`.tmp/mission-card-upgrade/04-card-back-element.png`
- 任务锦囊卡面聚焦：`.tmp/mission-card-upgrade/05-card-front-element.png`
- 桌面端卡背页面：`.tmp/mission-card-upgrade/desktop-back-page.png`
- 桌面端卡面页面：`.tmp/mission-card-upgrade/desktop-front-page.png`
- 移动端卡背页面：`.tmp/mission-card-upgrade/mobile-back-page.png`
- 移动端卡面页面：`.tmp/mission-card-upgrade/mobile-front-page.png`
- 视觉验证指标：`.tmp/mission-card-upgrade/final-visual-smoke.json`

## 验证结果

- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。
- `npm run test -- src/components/student/student-quest-dashboard.test.tsx src/components/student/quest-dashboard/collection.test.tsx`：通过，2 个测试文件，10 个测试用例。
- `npm run build`：通过，Next.js 生产构建成功，61 个页面生成完成。
- Playwright 桌面验证：通过，能登录、进入 `/student/quests`、翻开任务卡，无控制台错误，无横向溢出。
- Playwright 移动端验证：通过，能翻卡，`scrollWidth === clientWidth`，快速导航不再遮挡卡片。
- code-review-graph：已刷新，`detect-changes --brief` 报告 0 个受影响 flow、0 个测试缺口、风险分 0.00。

## 注意事项

- 本轮只修改学生任务中心相关前端展示与交互，没有修改数据库、登录、支付、订阅、生产部署或真实数据。
- 本地验证端口为 `http://127.0.0.1:4327/student/quests`；`127.0.0.1:3000` 当前被另一个本地 Next 项目占用。
- 工作区仍有其他历史改动和未跟踪文件，本轮没有回滚或整理这些无关内容。

## 2026-07-06 补充：任务锦囊卡背无文字化

- 目标：任务锦囊的卡背只保留图案、纹样、光感和交互暗示，不再显示“任务卡背 / 今日航线 / 翻开任务锦囊 / 翻开任务正面”等可见文字；翻转到正面后才显示任务标题、目标、奖励和按钮。
- 生图使用：按需求调用 GPT 图像生成探索了两轮卡背方向；两次生成结果都包含不合适的英文/海报式文字或题材偏差，因此未直接作为生产资产使用。
- 最终实现：采用现有任务卡背底图 + 受生图方向启发的 SVG 星轨、弧线、圆点、琥珀/青绿色渐变和 CSS 光晕，保证卡背无可见文字、可本地维护、无额外图片依赖。
- 交互与无障碍：整张卡背仍是可点击按钮，读屏可通过 `aria-label` 知道会翻到哪张任务卡正面；可见层没有文字，避免和“正面才显示内容”的心智冲突。
- 浏览器证据：`.tmp/mission-card-no-text/desktop-back-element.png`、`.tmp/mission-card-no-text/mobile-back-element.png`、`.tmp/mission-card-no-text/desktop-front-element.png`、`.tmp/mission-card-no-text/mobile-front-element.png`。
- 自动证据：`.tmp/mission-card-no-text/no-text-smoke.json` 记录桌面与移动端 `backText=""`、禁词命中 `0`、正面有任务文本、无横向溢出、无控制台错误。
- 回归测试：`src/components/student/student-quest-dashboard.test.tsx` 新增卡背零可见文本断言，防止后续再误加卡背文案。

### 本轮验证命令

- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。
- `npm run test -- src/components/student/student-quest-dashboard.test.tsx src/components/student/quest-dashboard/collection.test.tsx`：通过，2 个文件，10 个测试。
- `npm run build`：通过，Next.js 生产构建完成。
- Playwright 本地渲染 smoke：通过，`1440x1100` 与 `390x844` 两档均无卡背可见文字、无横向溢出。
- `python -m code_review_graph update --repo . --base HEAD --skip-flows`：通过。
- `python -m code_review_graph detect-changes --repo . --base HEAD --brief`：通过，风险分 `0.00`。

## 2026-07-06 补充：任务锦囊轻提示与正面阅读层级

- 最新需求更新：上一轮“卡背完全无可见文字”的约束已被替换为“卡背在适宜位置保留一个简短、明显的翻转提示”。因此生产版本保留 `翻转卡片` 轻提示，但不恢复“任务卡背 / 今日航线 / 翻开任务锦囊 / 翻开任务正面”等冗长说明。
- 卡背处理：在卡背底部中央加入深色半透明胶囊按钮，含星标、`翻转卡片` 文案和箭头；保持卡面主体仍以图案、纹理、光感为主，降低认知负荷。
- 卡正面处理：把任务目标和完成奖励拆成两张高对比信息卡，标签分别为 `本次任务目标` 与 `完成后奖励`；标题、奖励、详情入口加粗放大，便于学生快速扫读。
- 移动端补充：任务卡正面标题在小屏下收敛字号和头像尺寸，避免“分散度达到 72 分”等标题被拆成过多碎行；平板和桌面继续保留大标题气势。
- 自动证据：`.tmp/mission-card-flip-cue/evidence.json` 记录桌面与移动端均满足 `backHasFlipCue=true`、`oldBackCopyPresent=false`、`frontHasTargetLabel=true`、`frontHasRewardLabel=true`、`frontHasDetailButton=true`、`overflow=false`、`pageErrorCount=0`。
- 视觉证据：`.tmp/mission-card-flip-cue/desktop-card-back.png`、`.tmp/mission-card-flip-cue/desktop-card-front.png`、`.tmp/mission-card-flip-cue/mobile-card-back.png`、`.tmp/mission-card-flip-cue/mobile-card-front.png`。

### 本轮补充验证命令

- `npm run test -- src/components/student/student-quest-dashboard.test.tsx src/components/student/quest-dashboard/collection.test.tsx`：通过，2 个测试文件，10 个测试用例。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。
- `npm run build`：通过，Next.js 生产构建完成。
