# Brown Zone 任务中心视觉与交互截图验收（2026-06-29 15:30 PDT）

## 验收范围

本轮针对 `/student/quests` 做真实浏览器级别的视觉与交互检查，补齐上一轮内测中标记的 P1 缺口：缺少任务卡背面、翻面后正面、移动端布局的截图证据。

## 工具与能力状态

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Playwright | 可用 | `npx playwright --version` 返回 `1.59.1`。 |
| 本地服务 | 可用 | `http://127.0.0.1:4173/student/quests` 返回 200。 |
| CodeRabbit CLI | 不可用 | `coderabbit --version` 未找到命令；按技能要求尝试 `curl.exe -fsSL https://cli.coderabbit.ai/install.sh \| sh`，失败原因为当前 PowerShell 环境没有 `sh`。本轮不把本地审查冒充 CodeRabbit 结果。 |

## 截图证据

| 状态 | 截图路径 | 结论 |
| --- | --- | --- |
| 桌面：任务卡背面 | `docs/internal-playtest-screenshots/2026-06-29-quest-flip/desktop-card-back.png` | 任务卡背面以动物角色和盲盒视觉呈现，主卡、任务队列、收藏/成就区域层级清晰。 |
| 桌面：翻到正面 | `docs/internal-playtest-screenshots/2026-06-29-quest-flip/desktop-card-front.png` | 正面展示任务目标、学习提示、领取按钮和任务详情入口；翻面后焦点进入可见操作。 |
| 移动端：任务卡背面 | `docs/internal-playtest-screenshots/2026-06-29-quest-flip/mobile-card-back.png` | 页面纵向很长但无横向溢出；主要模块可以顺序阅读。 |

## Playwright 自动检查结果

```json
{
  "desktop": {
    "overflow": false,
    "activeTestId": "quest-detail-trigger-diversification-72",
    "firstFrontAriaHidden": "false"
  },
  "mobile": {
    "overflow": false
  },
  "consoleErrors": []
}
```

## 多角色验收意见

| 角色 | 结论 |
| --- | --- |
| 前端视觉 QA | APPROVE：任务卡翻面前后视觉状态可区分，暗色/亮色区域对比度可接受。 |
| 交互体验审查 | APPROVE：点击翻面后不是只改变文本，而是完整切换为正面任务卡，游戏感更强。 |
| 可访问性审查 | APPROVE：翻面后焦点落在 `quest-detail-trigger-*`，隐藏面没有继续占据可操作状态。 |
| 移动端审查 | APPROVE WITH NOTE：移动端无横向溢出，但页面非常长，后续可考虑增加“回到任务队列/今日任务”快捷锚点。 |
| 教育游戏审查 | APPROVE：卡背只给角色、进度和动作暗示，正面再揭示学习目标，符合降低认知负荷的路径。 |

## 仍需继续优化的问题

| 优先级 | 问题 | 建议 |
| --- | --- | --- |
| P2 | 移动端任务中心纵深很长 | 增加悬浮小目录或“回到任务队列”按钮，但不要遮挡 KeyAI。 |
| P2 | 任务中心 IP 风格强于策略台/市场页 | 下一轮把动物伙伴作为跨页面的轻量提示系统，而不是只留在任务中心。 |
| P2 | CodeRabbit 远程审查未跑通 | 安装 Git Bash 或 WSL 后重新执行 `coderabbit auth login --agent` 与 `coderabbit review --agent`。 |

## 验收结论

任务中心翻卡交互在桌面和移动端均可用，截图与自动检查均未发现横向溢出、控制台错误或翻面后隐藏面抢焦点的问题。本轮建议通过，并把下一阶段重点放到移动端纵深导航和跨页面 IP 一致性。
