# Brown Zone 三轮真实用户模拟内测报告（2026-07-05）

## 1. 内测目标

本轮目标是模拟真实用户连续使用 Brown Zone，严格等待页面跳转、接口响应、内容渲染或状态保存完成后再进入下一步，完成不少于 3 个周期的检查，并输出可复核证据。

重点覆盖：

- 登录弹窗与错误提示。
- 游客体验进入学生投资平台。
- 学生核心页访问与横向溢出检查。
- 风险测评交互与持久化。
- 移动端布局、乱码与核心模块回归。

## 2. 使用的 agent / skill / 插件 / 工具

| 类别 | 名称 | 使用方式 | 状态 |
| --- | --- | --- | --- |
| 监督层 | `dev-supervisor` | 刷新监督上下文、记录目标、YOLO 执行和证据门禁。 | 已使用 |
| 编码纪律 | `karpathy-principles` | 本轮只做窄范围文档与验证，不做无关重构。 | 已使用 |
| 浏览器自动化 | Playwright via Node runtime | 模拟桌面和移动端真实点击、输入、等待接口、截图和检测横向溢出。 | 已使用 |
| Browser 插件 | `browser` | 当前回合未暴露可直接调用的浏览器 MCP；使用 Playwright 作为可验证替代。 | 降级替代 |
| Jam | `jam` | 未提供 Jam 录制 ID；本轮不调用远程录制分析。 | 未使用 |
| GitHub | `github` / web search | 做 3 轮外部检索方向扩展，抽取 E2E 等待、登录、可用性检查策略。 | 已使用 |
| DataCamp / edX | connector apps | 与本轮产品内测无直接数据源或课程播放任务，未调用。 | 跳过 |

## 3. 三轮检索扩展摘要

| 轮次 | 检索范围 | 落地到内测的规则 |
| --- | --- | --- |
| Round 1 | 官方风格 E2E 等待纪律 | 点击后等待接口响应或可见状态，不用固定 sleep 代替真实结果。 |
| Round 2 | 开源项目 E2E 模式 | 已登录路径优先使用 API 登录建立会话；关键状态保存截图证据；避免宽泛定位器。 |
| Round 3 | 青少年教育产品可用性 | 检查中文可读性、清晰错误提示、移动端无横向溢出、低摩擦游客入口。 |

## 4. 测试环境

- 本地服务：`http://127.0.0.1:4327`
- 桌面视口：`1440 x 1100`
- 移动视口：`390 x 844`
- 证据文件：`.tmp/three-cycle-user-qa/evidence.json`
- 截图目录：`.tmp/three-cycle-user-qa/`

## 5. Cycle 1：新用户入口与游客体验

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| `/demo?auth=login` 自动打开登录弹窗 | PASS | `cycle1-login-error.png` |
| 故意输错密码后返回 401 | PASS | `/api/auth/login` 返回 401 |
| 错误提示为中文且符合主流登录体验 | PASS | “账号或密码错误，请重新输入。” |
| 游客体验按钮可见 | PASS | Playwright 可见性断言 |
| 游客体验登录接口成功 | PASS | `/api/auth/demo-login` 返回 200 |
| 游客进入 `/student` 后学生页可见 | PASS | `cycle1-guest-student.png` |
| 桌面学生页无横向溢出 | PASS | `scrollWidth=1440`, `clientWidth=1440` |

说明：Cycle 1 的 `consoleErrors` 中记录了一个 401，这是故意输错密码产生的预期负向路径，不是产品故障。

## 6. Cycle 2：已登录学生核心模块路径

| 页面 / 操作 | 结果 | 关键证据 |
| --- | --- | --- |
| `/student` 学生策略台 | PASS | 页面可见，无横向溢出 |
| `/student/market` 市场信息 | PASS | 页面可见，无横向溢出 |
| `/student/quests` 任务中心 | PASS | 页面可见，无横向溢出 |
| `/student/risk-profile` 风险测评 | PASS | 页面可见，无横向溢出 |
| `/student/credit` 信用实验室 | PASS | 页面可见，无横向溢出 |
| 风险测评翻卡提交 | PASS | `POST /api/student/risk-profile` 返回 200，`persisted=true` |
| 控制台错误 | PASS | 无 console error / page error |

主要接口响应均为 200，包括：

- `/api/market/season-leaderboard`
- `/api/leaderboard/me`
- `/api/billing/status`
- `/api/market/portfolio-intel`
- `/api/ai/radar-chart`
- `/api/market/board?category=us&symbol=NVDA`
- `/api/student/watchlist?symbol=NVDA`
- `/api/market/peer-heat`
- `/api/student/risk-profile`

## 7. Cycle 3：移动端、异常输入与回归路径

| 页面 / 操作 | 结果 | 关键证据 |
| --- | --- | --- |
| 移动端登录弹窗 | PASS | `cycle3-mobile-login.png` |
| 移动端 `/student` | PASS | 无横向溢出，无乱码标记 |
| 移动端 `/student/market` | PASS | 无横向溢出，无乱码标记 |
| 移动端 `/student/quests` | PASS | 无横向溢出，无乱码标记 |
| 移动端 `/student/risk-profile` | PASS | 无横向溢出，无乱码标记 |
| 移动端 `/student/credit` | PASS | 无横向溢出，无乱码标记 |
| 控制台错误 | PASS | 无 console error / page error |

## 8. 截图证据清单

- `.tmp/three-cycle-user-qa/cycle1-login-error.png`
- `.tmp/three-cycle-user-qa/cycle1-guest-student.png`
- `.tmp/three-cycle-user-qa/cycle2-student-home.png`
- `.tmp/three-cycle-user-qa/cycle2-student-market.png`
- `.tmp/three-cycle-user-qa/cycle2-student-quests.png`
- `.tmp/three-cycle-user-qa/cycle2-student-risk-profile.png`
- `.tmp/three-cycle-user-qa/cycle2-student-credit.png`
- `.tmp/three-cycle-user-qa/cycle2-risk-profile-submitted.png`
- `.tmp/three-cycle-user-qa/cycle3-mobile-login.png`
- `.tmp/three-cycle-user-qa/cycle3-mobile-student.png`
- `.tmp/three-cycle-user-qa/cycle3-mobile-student-market.png`
- `.tmp/three-cycle-user-qa/cycle3-mobile-student-quests.png`
- `.tmp/three-cycle-user-qa/cycle3-mobile-student-risk-profile.png`
- `.tmp/three-cycle-user-qa/cycle3-mobile-student-credit.png`

## 9. 发现与处理

本轮没有发现需要立即修改产品源码的阻塞问题。发现的 3 个问题均属于测试定位与证据呈现层面，已收录到 `docs/internal-user-simulation-issues-2026-07-05.md`：

1. 学生页有隐藏零尺寸标题文本，真实用户不可见，但会误导宽泛定位器。
2. 登录输入框早期定位器过宽。
3. 游客体验按钮早期定位器过宽。

这些问题已在本轮内测脚本执行过程中通过更精确的定位策略规避。

## 10. 结论

在本轮覆盖范围内，Brown Zone 的登录弹窗、错误提示、游客体验、学生核心模块、风险测评提交和移动端核心路径均通过内测。建议下一阶段把本轮脚本固化为正式 Playwright E2E，并为关键交互节点补充稳定测试 ID。

