import { defineConfig, devices } from "playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "4173";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  // E2E 跑的是 dev 服务器（按需编译 + HMR + AI 轮询 + GSAP 计时器），交互密集的用例
  // （尤其 student-gameflow-regression 的翻卡/全屏弹窗/键盘序列）在并行负载下会撞上
  // 「点击/按键早于 React 水合挂上 handler」的时序竞态——隔离必过、CI 2-worker 必过，
  // 但本地满载偶发。retries 是 dev-server E2E 的标准缓解：真缺陷 3 次全挂，时序抖动重试即过，
  // 且 Playwright 会把「重试后通过」单独标记为 flaky，可见性不丢。
  retries: 2,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      // E2E should be deterministic on teacher laptops and CI. By default it
      // exercises the app's supported offline demo store; set
      // PLAYWRIGHT_DATABASE_URL to explicitly run against a real Postgres DB.
      DATABASE_URL: process.env.PLAYWRIGHT_DATABASE_URL ?? "",
      ALLOW_MEMORY_FALLBACK: process.env.ALLOW_MEMORY_FALLBACK ?? "true",
      DB_QUERY_TIMEOUT_MS: process.env.DB_QUERY_TIMEOUT_MS ?? "350",
      // 全套 e2e 用同一演示账号在几分钟内登录数十次，会打爆 login-account
      // 12 次/10 分钟 限流（429 → 平台层重定向 /demo → 用例 120s 超时）。
      // 仅测试 server 放宽 20 倍；生产不设此变量，安全姿态不变。
      // 注意：reuseExistingServer=true 时若你手动预启了 server，需要自带该变量。
      E2E_RATE_LIMIT_MULTIPLIER: process.env.E2E_RATE_LIMIT_MULTIPLIER ?? "20",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
