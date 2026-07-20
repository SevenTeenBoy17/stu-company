# Brown Zone 10 小时内部内测马拉松

## 目标

对当前 Brown Zone Web 应用执行不少于 10 小时的真实内部巡检，模拟公司内测流程中的“持续测试 -> 问题归档 -> 安全修复 -> 复测确认”闭环。

本轮重点不是生产部署，也不是破坏性数据库操作；重点是持续发现学生端核心路径中的视觉、交互、可访问性、构建和回归问题。

## 范围

重点路由：

- `/`
- `/demo`
- `/pricing`
- `/student`
- `/student/quests`
- `/student/market`
- `/student/rank`

重点视口：

- Mobile: `390x844`
- Tablet: `768x1024`
- Desktop: `1440x1100`

重点检查项：

- 页面是否 5xx 或白屏。
- 是否出现英文错误页，例如 `This page couldn't load`。
- 是否出现明显乱码、`undefined`、`NaN`。
- 是否出现横向溢出。
- 任务中心翻面卡是否有隐藏面残留、镜像文本、卡背泄露正面内容。
- 核心测试、类型检查、lint、生产构建是否通过。

## 运行方式

一次短跑 smoke：

```powershell
node scripts/internal-qa-marathon.mjs --once --duration-hours 0.01 --interval-minutes 0.01
```

10 小时长跑：

```powershell
node scripts/internal-qa-marathon.mjs --duration-hours 10 --interval-minutes 30
```

后台长跑由 Codex 启动时会使用：

```powershell
Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "scripts/internal-qa-marathon.mjs --duration-hours 10 --interval-minutes 30" -WorkingDirectory "<repo>"
```

## 证据位置

每次运行会生成独立目录：

```text
.tmp/internal-qa-marathon/<timestamp>/
```

主要文件：

- `events.jsonl`: 每个命令、浏览器检查、错误和迭代状态的机器可读日志。
- `summary.md`: 人类可读的迭代总览。
- `screenshots/`: 失败页面和 `/student/quests` 固定截图。

## 修复策略

可以自动修复的范围：

- 明显 UI 文案显示错误。
- 非破坏性的样式、布局、可访问性问题。
- 测试断言与当前产品契约不一致的问题。
- 已有组件内部的小范围交互问题。

需要人工确认或另开阶段的范围：

- 数据库迁移、删除数据、生产部署。
- 真实支付、真实发送邮件、真实外部接口扣费。
- 大范围产品信息架构改动。
- 修改公开演示账号、密钥、`.env.local`。

## 初始验收门槛

每轮至少尝试：

- `npm run lint -- --quiet`
- `npx tsc --noEmit`
- `npx vitest run src/components/student/student-quest-dashboard.test.tsx`
- `npx vitest run src/lib/quests.test.ts src/lib/api-response.test.ts src/components/shared/global-ai-assistant.test.tsx`
- `npm run build`
- Chrome 多视口页面巡检

## 当前状态

- Runner: `scripts/internal-qa-marathon.mjs`
- 启动目标: `10h / 30min interval`
- 监督轮次: `round-10h-internal-qa-20260701`
- 风险级别: T2，本地可逆测试/文档/日志，不做 T3 操作。
