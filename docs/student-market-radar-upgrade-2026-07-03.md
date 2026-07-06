# 学生端市场雷达图标与板块筛选升级记录

日期：2026-07-03

## 背景

参考图中“市场信息 / 市场雷达”顶部观察池存在三个体验问题：

- 观察池卡片使用首字母圆标，缺少公司/行业相关图案，视觉识别弱。
- 卡片被压成多列窄块，中文公司名在窄宽度里容易被强制拆成竖排。
- 右侧空白区域没有承接内容，可用于增加“科技、医药、金融、基金”等板块入口。

本次目标是在不改动后端接口、不触碰支付/数据库迁移/生产配置的前提下，完成美股、A股、港股、基金四类市场的统一体验升级。

## 实现内容

### 1. 原创图案资产

使用内置 `imagegen` 生成原创市场主题徽章图，不复刻真实公司 logo，避免版权风险和真实投研误导。

生成提示词摘要：

> 4×4 premium rounded-square market category badges for a teen financial education dashboard; no text, no real company logos; themes include AI chip, cloud software, AI platform, EV robotics, healthcare medicine, finance, ecommerce, telecom, broad index, overseas tech, etc.

项目资产位置：

- `public/brand/market-radar-icons/market-radar-icon-sheet.png`
- `public/brand/market-radar-icons/*.webp`
- `public/market/industries/healthcare-medicine.webp`

### 2. 数据层轻量扩展

文件：

- `src/lib/market-catalog.ts`
- `src/lib/market-watchlist.ts`
- `src/lib/types.ts`

改动：

- 新增 `healthcare-medicine` 行业 key。
- A股新增 `恒瑞医药`，港股新增 `药明生物`，基金新增 `医疗ETF`，让“医药”按钮点击后有真实教学样本。
- `TickerTapeItem` 增加 `sector / sectorGroup / tags`，用于前端按板块筛选。
- 新增 `marketBadgePath()`，观察池小卡使用原创徽章；大图仍保留原有行业示意图。

### 3. 前端布局与交互

文件：

- `src/components/student/student-market-board.tsx`

改动：

- 新增市场主题归类函数，把不同分类下的标的归入 `科技 / 云软件 / AI平台 / 消费 / 新能源 / 金融 / 红利 / 医药 / 宽基 / 海外科技` 等学生更容易理解的方向。
- 在“市场信息”右侧顶部增加板块按钮组，点击后展示对应方向下的股票或基金。
- 观察池卡片从窄方块改为横向矩形布局：`图案 + 名称/代码/板块 + 价格/涨跌`。
- 删除强制拆字的 `break-all` 风险，名称改为单行横向截断。
- 增加 `data-testid` 标记，便于后续自动化验证四类市场与板块按钮交互。

### 4. 同类问题修复

搜索学生端内的 `break-all` 后，发现两个同类排版风险点并修复：

- `src/components/student/student-allocation-panel.tsx`
- `src/components/student/student-history-review-dashboard.tsx`

两处均改为 `break-words + line-clamp`，避免中文标签在窄卡片中逐字竖排。

## 验收证据

### 自动化验证

- `npx tsc --noEmit`：通过
- `npm run lint`：通过
- `npm test`：95 个测试文件、643 个测试通过
- `npm run build`：Next.js 生产构建通过

### 浏览器视觉/交互验证

临时脚本：

- `.tmp/market-radar-upgrade/market-radar-check.js`

覆盖视口：

- 桌面：`1440×1100`
- 平板：`768×1024`
- 手机：`390×844`

覆盖交互：

- 依次切换 `美股 / A股 / 港股 / 基金`
- 每类至少存在 1 个非“全部”的板块按钮
- 点击板块按钮后仍能显示对应股票/基金卡片
- 无横向溢出
- 观察卡名称没有多行竖排
- 观察卡存在图案图片

截图：

- `.tmp/market-radar-upgrade/desktop-student-market.png`
- `.tmp/market-radar-upgrade/tablet-student-market.png`
- `.tmp/market-radar-upgrade/mobile-student-market.png`

## 设计说明

- 图案采用原创行业徽章，而不是官方 logo：既满足识别需求，也避免学生误以为这是正式券商/基金销售界面。
- 板块按钮使用“学生理解优先”的语言，不直接堆真实行业分类术语。
- 手机端保持单列纵向阅读，平板端自然堆叠，桌面端恢复更高信息密度。
- 本页仍是只读市场观察，不增加真实交易或付费行为入口。

## 2026-07-03 追加优化：总控弹层与具体标的徽章

### 追加背景

第二轮审阅发现：把所有板块按钮长期展示在“市场信息”顶部，虽然功能完整，但会在桌面上压缩首屏留白，在手机端也容易形成“按钮墙”。同时，第一阶段资产更偏“行业示意”，用户希望股票、基金、公司图案更接近具体标的的识别方式。

### 追加实现

- 将“全部”改成市场主题总控按钮。关闭态只显示一个横向控制卡，展示当前筛选状态和样本数量。
- 点击“全部”后再弹出具体板块：`全部 / 科技 / 云软件 / AI平台 / 消费 / 新能源 / 金融 / 红利 / 医药 / 宽基 / 海外科技` 等，按当前市场类别动态生成。
- 弹层选择某个板块后自动关闭，并自动选中该板块下的首个标的，减少额外点击。
- 使用 GPT 生图生成 32 个原创“标的识别徽章”，再裁切为独立 WebP 文件，覆盖美股、A股、港股、基金全部观察池。
- 观察池卡片和选中股票主卡均展示具体标的徽章；主卡保留行业氛围横幅，同时叠加具体徽章，兼顾高级感和识别度。
- 参考公开 logo 的颜色、形状和行业联想，但不复刻官方商标，不把页面包装成真实券商投研或基金销售界面。

新增资产：

- `public/brand/market-symbol-icons/market-symbol-icon-sheet.png`
- `public/brand/market-symbol-icons/*.webp`

关键文件：

- `src/lib/market-catalog.ts`
- `src/lib/market-watchlist.ts`
- `src/lib/types.ts`
- `src/components/student/student-market-board.tsx`
- `.tmp/market-radar-upgrade/market-radar-check.js`

### 追加验证证据

自动化：

- `npx tsc --noEmit --pretty false`：通过
- `npm test -- src\lib\market-catalog.test.ts src\components\student\student-market-board.test.ts`：2 个测试文件、10 个测试通过
- `node .tmp\market-radar-upgrade\market-radar-check.js`：通过

浏览器脚本覆盖：

- 桌面 `1440×1100`、平板 `768×1024`、手机 `390×844`
- `美股 / A股 / 港股 / 基金` 四类均验证
- 关闭态 `market-theme-button` 数量为 0，证明分类按钮不再常驻挤占空间
- 点击 `market-theme-control` 后弹层内分类按钮数量均大于 1
- 选择具体板块后弹层关闭，观察池仍有卡片
- 观察池卡片使用 `market-symbol-icons`
- 选中主卡存在 `market-selected-symbol-icon`
- 页面无横向溢出，观察卡名称没有竖排/过窄

截图：

- `.tmp/market-radar-upgrade/desktop-student-market.png`
- `.tmp/market-radar-upgrade/tablet-student-market.png`
- `.tmp/market-radar-upgrade/mobile-student-market.png`
- `.tmp/market-radar-upgrade/mobile-theme-menu-open.png`
- `.tmp/market-radar-upgrade/design-qa-comparison.png`
