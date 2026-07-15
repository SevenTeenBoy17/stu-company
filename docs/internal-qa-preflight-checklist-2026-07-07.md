# Brown Zone 12 小时内测启动前检查清单

状态：待执行  
用途：用户确认开始后，按此清单启动真实 12 小时内测。  
重要边界：本文件不是内测结果；只有完成真实 12 小时运行、问题记录、修复与回归后，目标才算接近完成。

## 1. 启动模式选择

推荐模式：

```text
本地完整内测 + 线上只读 smoke
```

原因：

- 本地完整内测可以安全覆盖注册、游客、学生操作、后台和异常路径。
- 线上只读 smoke 可以检查正式域名可访问性，但不破坏线上数据。
- 支付、数据库迁移、密钥、生产部署均保持受控，不在内测中直接改动。

可选模式：

| 模式 | 说明 | 风险 |
| --- | --- | --- |
| 仅本地12小时内测 | 完整功能在本机跑，不碰线上 | 无法验证正式域名 |
| 本地完整内测 + 线上只读 smoke | 推荐，覆盖面和安全性平衡 | 线上仅能验证只读路径 |
| 线上完整内测 | 不推荐，可能污染真实数据 | 需要用户额外明确授权 |

## 2. 启动前环境检查

在项目根目录执行：

```powershell
cd "D:\树德实验中学（清波）\C2\brown-zone-web"
npm run env:doctor
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

通过标准：

- `env:doctor` 不暴露密钥原文，且没有关键变量缺失。
- `lint` 通过。
- `tsc` 通过。
- `test` 通过或失败项被记录并判定是否阻断。
- `build` 通过。

如果任一项失败：

1. 记录失败命令。
2. 保存完整错误摘要。
3. 判断是否为 P0/P1 阻断。
4. 只修复安全、可逆、明确的问题。
5. 修复后重新跑对应命令。

## 3. 本地服务启动

默认内测服务：

```powershell
$env:ALLOW_MEMORY_FALLBACK="true"
$env:E2E_RATE_LIMIT_MULTIPLIER="20"
$env:DB_QUERY_TIMEOUT_MS="350"
npm run dev -- --hostname 127.0.0.1 --port 4173
```

验证地址：

```text
http://127.0.0.1:4173
```

如果 4173 被占用：

```powershell
$env:PLAYWRIGHT_PORT="4300"
npm run dev -- --hostname 127.0.0.1 --port 4300
```

## 4. 自动化基线命令

内测开始后，先跑一轮基线：

```powershell
npx playwright test tests/e2e/prelaunch.spec.ts
npx playwright test tests/e2e/page-a11y-smoke.spec.ts
npx playwright test tests/e2e/student-gameflow-regression.spec.ts
```

可选扩展：

```powershell
npx playwright test tests/e2e/student-internal-test.spec.ts
npx playwright test tests/e2e/phase4-business-chain.spec.ts
npx playwright test tests/e2e/ux-audit.spec.ts
```

注意：

- Playwright 配置默认使用 `PLAYWRIGHT_PORT`，未设置时为 4173。
- 当前配置默认允许内存 fallback，更适合安全内测。
- 如果测试失败，必须打开 trace 或截图确认用户可见影响，不能只看断言名称。

## 5. 真实用户手动路径

### 5.1 公共入口

| 步骤 | 必须等待 |
| --- | --- |
| 打开 `/` | 首页主体和导航可见 |
| 点击登录 | 登录弹窗出现 |
| 输错密码 | 中文错误出现 |
| 关闭弹窗 | 页面恢复可操作 |
| 点击立即体验 | 进入体验入口或登录/游客选择 |

### 5.2 游客路径

| 步骤 | 必须等待 |
| --- | --- |
| 点击游客体验 | `/api/auth/demo-login` 返回成功或可读错误 |
| 进入 `/student` | 学生策略台关键标题可见 |
| 点击任务中心 | `/student/quests` 加载完成 |
| 点击充值入口 | 出现游客升级/绑定账号提示，不直接给共享游客付费 |

### 5.3 学生路径

| 模块 | 必测动作 |
| --- | --- |
| 策略总览 | 下单、储蓄、推进回合、AI 复盘 |
| 市场信息 | 搜索、切换股票、AI 解读、观察池榜单 |
| 任务中心 | 地图节点、放大地图、任务队列、翻任务卡、领取学习卡 |
| 我的财富 | 持仓、目标、配置建议 |
| 生活账本 | 添加/查看生活预算类动作 |
| 信用实验室 | 模拟借款、提前还款、反馈 |
| 风险测评 | 翻卡、提交、结果持久化 |

### 5.4 超级管理员路径

| 步骤 | 必须等待 |
| --- | --- |
| 用 `superadmin` 登录 | 进入 `/admin` |
| 搜索用户 | 用户列表过滤完成 |
| 创建用户 | API 返回成功，列表出现新用户 |
| 修改邮箱 | API 成功，旧会话失效或 tokenVersion 更新 |
| 重置密码 | 成功提示出现，新密码可登录 |
| 修改订阅状态 | UI 与 API 数据一致 |

## 6. 账号记录

只记录演示账号，不写入真实密钥。

| 角色 | 账号 | 密码 | 用途 |
| --- | --- | --- | --- |
| 学生 | `student@brownzone.ai` | `BrownZone2026!` | 学生主流程 |
| 教师 | `teacher@brownzone.ai` | `BrownZone2026!` | 如需验证教师保留能力 |
| 家长 | `parent@brownzone.ai` | `BrownZone2026!` | 如需验证家长保留能力 |
| 管理员 | `admin@brownzone.ai` | `BrownZone2026!` | 普通 admin 权限对照 |
| 超级管理员 | `superadmin` | `Super001!!!` | 后台写权限 |

## 7. 证据目录约定

正式启动后创建：

```text
.tmp/internal-qa-marathon-2026-07-07/
  events.jsonl
  hourly/
  screenshots/
  traces/
  api/
  summaries/
```

每个事件至少包含：

```json
{
  "time": "ISO 时间",
  "actor": "guest/student/admin/system",
  "route": "/student/quests",
  "action": "点击放大地图",
  "waitedFor": "modal visible",
  "result": "pass/fail",
  "evidence": "screenshots/..."
}
```

## 8. 每小时节奏

| 时间点 | 产物 |
| --- | --- |
| H0 | 环境检查结果 |
| H1 | 公共入口和登录结果 |
| H2 | 游客体验和注册结果 |
| H3 | 学生策略台结果 |
| H4 | 市场/AI 结果 |
| H5 | 任务中心结果 |
| H6 | 财富/生活/信用结果 |
| H7 | 移动端和平板结果 |
| H8 | 后台管理结果 |
| H9 | 异常路径结果 |
| H10 | 修复清单和根因 |
| H11 | 回归验证 |
| H12 | 总报告和剩余风险 |

## 9. 禁止事项

- 不做真实扣款。
- 不修改 `.env.local` 或提交密钥。
- 不执行 `git reset --hard`、强推、删除数据。
- 不直接修改生产数据库结构。
- 不部署，除非用户在内测完成后明确要求。
- 不把“静态页面看起来正常”当作通过。

## 10. 开始口令

尚未收到以下口令前，不开始真实 12 小时内测：

```text
确认，开始12小时内测
```

或：

```text
确认，仅本地12小时内测
```

或：

```text
确认，本地完整内测 + 线上只读 smoke
```

