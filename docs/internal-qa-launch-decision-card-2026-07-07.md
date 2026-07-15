# Brown Zone 12 小时内测启动决策卡

状态：等待用户确认，尚未开始。  
当前目标：完成不少于真实 12 小时的全面内测、问题汇总、自我迭代修复、三轮回归与最终报告。

## 已准备好

- Review 包：[docs/internal-qa-marathon-plan-2026-07-07.md](./internal-qa-marathon-plan-2026-07-07.md)
- 启动前检查清单：[docs/internal-qa-preflight-checklist-2026-07-07.md](./internal-qa-preflight-checklist-2026-07-07.md)
- 问题记录模板：[docs/internal-qa-issue-template-2026-07-07.md](./internal-qa-issue-template-2026-07-07.md)

## 推荐启动方式

```text
确认，本地完整内测 + 线上只读 smoke
```

推荐理由：

- 本地环境可以完整覆盖注册、游客、学生操作、后台、AI、异常路径和修复回归。
- 线上只读 smoke 可以确认正式域名可访问，但不污染真实数据。
- 支付、数据库、密钥、部署等高风险动作保持冻结。

## 不同启动口令对应行为

| 用户口令 | 行为 |
| --- | --- |
| `确认，开始12小时内测` | 默认采用推荐模式：本地完整内测 + 线上只读 smoke |
| `确认，仅本地12小时内测` | 只跑本地，不访问线上正式域名 |
| `确认，本地完整内测 + 线上只读 smoke` | 推荐模式，覆盖最均衡 |

## 启动后第一小时动作

1. 创建 `.tmp/internal-qa-marathon-2026-07-07/` 证据目录。
2. 运行 `npm run env:doctor`、`npm run lint`、`npx tsc --noEmit`、`npm run test`、`npm run build`。
3. 启动本地服务：`npm run dev -- --hostname 127.0.0.1 --port 4173`。
4. 跑基线 E2E：`prelaunch.spec.ts`、`page-a11y-smoke.spec.ts`、`student-gameflow-regression.spec.ts`。
5. 写入 H0/H1 小时摘要。

## 启动后必须遵守

- 每个用户动作都要等待真实返回。
- 每个失败都要记录证据、根因和修复建议。
- 只自动修复明确、可逆、低风险问题。
- 不做真实扣款。
- 不改生产密钥。
- 不删除或迁移生产数据库。
- 不部署，除非内测结束后用户明确要求。

## 仍未完成的原因

用户原始目标要求“开始内测前先可视化过程并返回 review 后再进行”。当前尚未收到确认口令，因此目标保持未完成，不能标记 complete。

