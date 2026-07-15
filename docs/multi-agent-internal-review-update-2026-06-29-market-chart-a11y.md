# 学生市场页图表可访问性补充

## 背景

本轮内部 QA 继续处理学生端市场信息页的可访问性细节。页面已有 K 线、6 维雷达和观察池板块结构等视觉图表，但仅依赖 SVG 形状对学生和辅助技术都不够友好。

## 本轮改动

- 为 K 线图新增可见文本摘要，解释当前价、日内变化、近期趋势点、最近 K 线收涨数量，并保留“课堂复盘，不代表真实交易信号”的边界。
- 为 6 维教学观察雷达新增强弱项摘要，提示学生先比较最高/最低维度，再结合右侧说明写证据。
- 为观察池结构图新增板块摘要，说明覆盖板块数量、最强板块、最弱板块和代表标的。
- 将摘要生成逻辑做成可测试纯函数，避免后续 UI 重构时丢失等价文本。

## 验证

```text
npm test -- src/components/student/student-market-board.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)

npx tsc --noEmit --pretty false
PASS

npm run lint
PASS

npm run build
PASS

python -m code_review_graph update
PASS

python -m code_review_graph detect-changes --brief --base HEAD
Overall risk score: 0.00

Playwright smoke on http://127.0.0.1:4173/student/market
PASS
market-kline-summary / market-radar-summary / market-sector-summary all rendered
document overflow: false (scrollWidth 1440, clientWidth 1440)
```

## 结论

通过。图表现在不再只依赖视觉形状表达关键信息，学生能直接读到短摘要，屏幕阅读器用户也能获得稳定的文本解释。
