# 沧海数据 (Tsanghi) 行情 API 接入技术文档

> 验证日期：2026-06-22。本文所有端点/字段/返回码均以**真实调用**（token 实测）核验，非凭文档臆测。
> 文档源：https://tsanghi.com/fin/doc （Vue SPA，需展开左侧栏逐节阅读）。

## 1. 关键事实（实测核验）

| 项 | 结论 |
|---|---|
| **真实 API Base** | `https://www.tsanghi.com/api/fin`（**不是** `api.tsanghi.com` —— 后者会 ECONNRESET / 证书错误；本机代理把 `api.tsanghi.com` fake-IP 到 `198.18.0.159`）|
| 鉴权 | `token` 查询参数（`?token=<API_TOKEN>`）|
| 返回包裹 | `{ "msg": "...", "code": <int>, "data": [...] }`；`code=200` 成功，`3002` 参数异常，`3003` 权限不足（套餐未开通）|
| 本机可达性 | `www.tsanghi.com` 从本机**可直连**（root 200；daily/exchange 实测 200）|
| **免费 token 权限** | ✅ 股票**日线** `daily`、外汇**日线** `forex/daily`、交易所/股票清单；❌ **实时行情 `realtime` 返回 3003 权限不足**；crypto daily 返回空；index daily 需正确 exchange/ticker |

> **结论：本次接入以「日线 EOD」为真实数据源**（实时被套餐墙挡住）。日线对教学完全够用，且 `daily/latest` 实测能取到**当日**收盘（如 NVDA 2026-06-22 close 208.65），数据是「当前」的。

## 2. 资产类别与栏目（左侧栏全量）

- **股票 Stock**：股票清单 / 交易所清单 / 国家地区清单 / 企业信息 / 企业高管 / 交易日历 / 日线·周线·月线·年线 / 1·5·15·30·60 分钟 / 实时行情 / 分红·送股·配股·股本 / 财务报表（每股收益·资产负债·利润·现金流，年/季）
- **指数 Index**：指数清单 / 日线~年线 / 分钟 / 实时行情 / 成分股
- **ETF**：ETF 清单 / 日线~年线 / 分钟 / 实时行情
- **外汇 Forex**：清单 / 日线~年线 / 分钟 / 实时行情
- **加密货币 Crypto**：清单 / 日线~年线 / 分钟 / 实时行情
- **其他**：通用代码 / 通用工具 / 附录

## 3. 接入用到的端点（核验）

### 3.1 股票日线（核心数据源）
```
GET /fin/stock/{exchange_code}/daily
        ?token=<TOKEN>&ticker=<TICKER>
        [&start_date=yyyy-mm-dd][&end_date=yyyy-mm-dd]
        [&limit=<int>][&order=0|1|2][&columns=...][&fmt=json|csv]
```
- `order`：**0=不排序（默认！）**，1=升序，2=降序。⚠️ 不传 `order` 时返回**乱序**，必须传 `order=2`（或自行按 date 排序）。
- 默认输出字段：`ticker, date(yyyy-mm-dd), open, high, low, close, volume`。
- 可选字段（需 `columns` 指定）：`amount`（成交额）、`pre_close`（昨收）。
- `start_date` 默认最近一年，`end_date` 默认最新日期。
- 实测返回：
```json
{"msg":"操作成功","code":200,"data":[
  {"ticker":"NVDA","date":"2026-06-01","open":215.73,"high":224.87,"low":215.70,"close":224.36,"volume":212850685.06}
]}
```

### 3.2 股票日线·最新一根
```
GET /fin/stock/{exchange_code}/daily/latest?token=&ticker=
```
返回**最新一个交易日**单根（含当日，如 2026-06-22）。

### 3.3 交易所清单
```
GET /fin/stock/exchange?token=
```
返回 `[{exchange_code, exchange_name, exchange_name_short, country_code, currency_code, local_open, local_close, beijing_open, beijing_close, timezone, ...}]`。

### 3.4 外汇日线（同结构）
```
GET /fin/forex/daily?token=&ticker=EURUSD&order=2&limit=N
```
返回 `{ticker, date, open, high, low, close}`（外汇无 volume）。实测当日 2026-06-22 可取。

## 4. 交易所代码 (exchange_code) 映射

| 市场 | code |
|---|---|
| 纳斯达克 | `XNAS` |
| 纽交所 | `XNYS` |
| 上交所 | `XSHG` |
| 深交所 | `XSHE` |
| 北交所 | `BJSE` |

**本应用观察池（US）映射**：NVDA / MSFT / AMZN / META / GOOG / AVGO / TSLA / MU → `XNAS`；ORCL / TSM → `XNYS`（实测 TSM@XNYS 可取）。

## 5. 接入设计（Brown Zone）

新增 provider `src/lib/tsanghi.ts`，与 `itick.ts` / `alltick.ts` 同构，作为 `getTickerTapePayload` / `getMarketBoardPayload`（`src/lib/market-data.ts`）的**首选** provider：

```
Tsanghi(日线真实) → iTick → AllTick → 教学兜底(fallback)
```

- **报价**：每个观察池 symbol 调 `daily?order=2&limit=2`，取最新 close 作现价、(最新-次新)/次新 作日涨跌幅。
- **K 线**：选中 symbol 调 `daily?order=2&limit=30`，客户端**按 date 升序排序**后取最近 ~24 根（不信任 API 顺序）。
- **优雅降级**：无 `TSANGHI_API_TOKEN` / `code≠200`（含 3003 权限）/ 超时 → 返回 `fallback` 并给中文 note，按 10 分钟节奏重试（沿用 `MARKET_REFRESH_INTERVAL_MS`）。
- **诚实标注**：数据为「真实**日线收盘**」而非分时实时，note/UI 文案据实表述（避免误导学生）。

### 环境变量
```
TSANGHI_API_TOKEN=<token>
TSANGHI_REST_BASE_URL=https://www.tsanghi.com/api/fin   # 可选，默认即此
```

## 6. 风险与数据质量（接入时必须把关）

1. **实时被套餐墙挡**（3003）：不调用 `realtime`，只用 `daily`/`daily/latest`，并 note 说明。
2. **乱序陷阱**：不传 `order` 返回乱序 → 代码内**强制按 date 排序**，杜绝 K 线错乱。
3. **数据异常值**：实测 `MU@XNAS` daily/latest close=**1211.38**，明显偏离常识（美光历史区间数百美元）。接入**不应隐藏真实值**，但内测须逐只核验，必要时在 UI 标注「数据来源/口径」并保留教学兜底对照。
4. **调用配额**：免费套餐每 ticker 计 1 次调用；观察池 10 只 → 每次刷新 ~10 次调用，靠 10 分钟缓存压低频次。
5. **本机网络**：`api.tsanghi.com` 被本机代理 fake-IP，务必用 `www.tsanghi.com/api/fin`；部署到 Vercel 等海外节点亦以该域为准。

## 7. 内测三轮闭环（20 个 agent）

| 轮次 | agent（种类） | 结果 |
|---|---|---|
| R1 发现 | 11 个：Backend Architect / Security Engineer / Investment Researcher（金融数据质量）/ API Tester / Test Results Analyzer / Frontend Developer / Accessibility Auditor / Code Reviewer / Reality Checker / UX Researcher / Performance Benchmarker | 汇总 P0–P3 若干 |
| → 修复 | code===200；Math.max(1,floor)+空 data[]→命名失败；确定性排序替 localeCompare；超时 10s→6s；watchlist in-flight 去重；board asOf=最新交易日；EOD 诚信文案（observationNote / ticker / 数据日期卡）；a11y（圆点 info-400 6.87:1 + aria-hidden/aria-live + Radar aria-hidden）；测试 3→9 例 | — |
| R2 复验 | 5 个：Backend / API Tester / Investment Researcher / UX / Accessibility | Backend·A11y APPROVE；其余确认核心修复落地，提呈现层残留 |
| → 修复 | N-1「数据日期」去 00:00 假时分；测试 9→12 例（HTTP502 / board-fallback / prev=0 零除）；默认市场 symbol MU→NVDA | — |
| R3 终审 | 4 个：Reality Checker / Code Reviewer / Test Results Analyzer / UX | 3 APPROVE；UX 提 1 个 P1（见下）|

**全量门禁（终态）**：vitest 572/572 · tsc 0 · lint 0 · 生产 build 0 · 真实冒烟 provider=tsanghi（10 只真价 + NVDA 24 根近期 K 线，最新 2026-06-22）。

### MU=1211 裁决（重要）
经金融数据 agent 用第三方源（Yahoo/CNBC/Macrotrends/Motley Fool）交叉验证：**MU≈$1211 是真实历史新高（AI 存储超级周期，YTD ~+300%），不是脏数据**。故**不加遮蔽真实值的合理性闸门**，改为诚实标注口径（EOD 收盘 / 交易日 / 非实时 / 非投资建议）。

### 已记录、留作后续的建议（非本次 API 接入引入，属既有教学板设计）
- **P1（既有）**：观察池卡的「教学综合评分」用 `metadata.fallbackSeries`（合成走势）计算，与真实现价并置，在 MU=1211 等极端真实值下显得不自洽。建议：实时分支下让评分也吃真实 quote/series，或给评分加「教学模型，非真实涨跌」口径标签。
- **P2/P3（呈现强化）**：hero 现价旁加「日线收盘」微标；趋势卡补「A 股红涨绿跌，与美股相反」一句；全页固定一处「教学用途，非投资建议」锚点；面向学生把「EOD」统一改白话；按美东时区格式化交易日。
- **性能（运维）**：board 冷启动「watchlist 并发段 + kline 串行段」在 CN→海外高延迟下墙钟可达 ~8.6s，建议给 board 一个聚合超时预算或把 kline 并入并发批次；board kline 拉取可加 in-flight 去重。
