# 学生端列表栏与情境卡背升级说明（2026-07-05）

## 目标

本次根据参考截图完成两处学生端体验升级：

1. 将定投机器人中的原生下拉列表升级为更有层次感、呼吸感和信息密度的自定义列表栏。
2. 将“6 个情境选择”卡片背面升级为超高清游戏化学习卡背，并替换原来的内嵌 SVG 图案。

## 设计判断

- 原生 `<select>` 的展开层由浏览器控制，视觉上容易出现系统默认感，且很难统一阴影、圆角、选中态和涨跌信息。因此改为自定义 `button + listbox + option` 结构。
- 情境卡背需要同时满足“神秘感”和“教育感”，不能像真实交易或博彩卡牌。本次生成图采用深海军蓝、琥珀罗盘、书本、问题符号、图表与决策图标，强调“先理解情境，再做选择”。
- 卡背文字层采用中文交互提示，避免英文残留影响中文学生端一致性。

## 资产生成

使用内置 `image_gen` 生成项目资产，最终复制到：

```text
public/brand/quest-cards/risk-scenario-card-back-v2.png
```

最终资产尺寸：

```text
1054 x 1492
```

核心提示词摘要：

```text
premium scenario card back illustration for a teen-friendly financial literacy game,
deep navy-black rounded playing card surface,
open book + compass needle + question mark + financial decision tokens,
warm amber highlights, muted teal secondary glow,
no real stock logos, no gambling symbols, education-first.
```

## 代码变更

### `src/components/student/student-auto-invest-dashboard.tsx`

- 新增 `assetListOpen` 状态。
- 将“定投标的”原生 `<select>` 替换为自定义列表栏。
- 列表项展示：资产名称、代码、当前价、日涨跌。
- 支持点击选中、Esc 关闭、失焦关闭。
- 增加测试标识：
  - `auto-invest-asset-selector`
  - `auto-invest-asset-list`

### `src/components/student/student-risk-profile-dashboard.tsx`

- 引入 `next/image`。
- 新增 `SCENARIO_CARD_BACK_SRC` 常量引用生成卡背。
- 用项目资产替换原来的内嵌 SVG 卡背图形。
- 增加中文覆盖徽章“探索情境”，增强卡片背面层次并覆盖生成图里的英文残留区域。
- 增加测试标识：
  - `risk-scenario-card-back-badge`

## 视觉内测证据

截图输出目录：

```text
.tmp/card-sidebar-upgrade-qa/
```

关键截图：

```text
.tmp/card-sidebar-upgrade-qa/auto-invest-listbox.png
.tmp/card-sidebar-upgrade-qa/risk-card-back-v2.png
```

自动化检查摘要：

```json
{
  "ok": true,
  "consoleErrors": [],
  "pageErrors": [],
  "autoMetrics": {
    "scrollWidth": 1440,
    "clientWidth": 1440,
    "listClosedAfterEscape": true
  },
  "riskMetrics": {
    "scrollWidth": 1440,
    "clientWidth": 1440,
    "cardBacks": 6,
    "badges": 6,
    "imageLoaded": true
  }
}
```

## 验证命令

已通过：

```powershell
npx tsc --noEmit --pretty false
npm run lint
npm run test -- src/components/student/student-risk-profile-dashboard.test.tsx src/lib/auto-invest.test.ts
npm run test
npm run build
```

验证结果：

- TypeScript：通过。
- ESLint：通过。
- 针对性测试：2 个文件、15 个测试通过。
- 全量测试：95 个测试文件、644 个测试通过。
- Next 生产构建：通过，61 个 app route 页面生成完成。

## 后续建议

1. 若后续继续做学生端“卡牌化任务”，建议统一建立 `student-card-back` 资产系统，按“基础 / 进阶 / 挑战”三档做不同色温。
2. 自定义列表栏可抽象为共享组件，但当前只在一个页面使用，暂不提前抽象，避免过度工程化。
3. 如需进一步提升无障碍，可增加上下箭头在 listbox 内移动焦点的键盘行为。

