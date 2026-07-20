// @vitest-environment node
//
// itest7 P3：CSRF 原语 checkOrigin 此前零单测，且无「每个变更路由都调用」的结构审计。
// (1) 单测覆盖四条分支（必须在 NODE_ENV=production 下，否则 :48 短路使断言恒真）。
// (2) 结构审计：凡导出 POST/PUT/PATCH/DELETE 的 route.ts 必须包含 checkOrigin，例外走显式白名单。

import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

async function loadCheckOrigin(appUrl: string | undefined) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SESSION_SECRET", "x".repeat(32)); // 生产 env 校验需要
  vi.stubEnv("APP_URL", appUrl ?? "");
  vi.resetModules();
  return (await import("@/lib/api-response")).checkOrigin;
}

function req(headers: Record<string, string>) {
  return new Request("https://app.brownzone.ai/api/x", { method: "POST", headers });
}

describe("checkOrigin CSRF primitive (itest7 P3)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("production: sec-fetch-site=cross-site → 403", async () => {
    const checkOrigin = await loadCheckOrigin("https://app.brownzone.ai");
    const res = checkOrigin(req({ "sec-fetch-site": "cross-site" }));
    expect(res?.status).toBe(403);
  });

  it("production: origin ≠ APP_URL → 403", async () => {
    const checkOrigin = await loadCheckOrigin("https://app.brownzone.ai");
    const res = checkOrigin(req({ origin: "https://evil.example.com" }));
    expect(res?.status).toBe(403);
  });

  it("production: same-origin → 放行(null)", async () => {
    const checkOrigin = await loadCheckOrigin("https://app.brownzone.ai");
    expect(checkOrigin(req({ origin: "https://app.brownzone.ai" }))).toBeNull();
  });

  it("production: 无 origin(非浏览器同源) → 放行(null)", async () => {
    const checkOrigin = await loadCheckOrigin("https://app.brownzone.ai");
    expect(checkOrigin(req({}))).toBeNull();
  });

  it("非 production 环境短路放行(null)——证明上面用例必须 stub production 才有意义", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { checkOrigin } = await import("@/lib/api-response");
    expect(checkOrigin(req({ "sec-fetch-site": "cross-site" }))).toBeNull();
    vi.unstubAllEnvs();
  });
});

// ── 结构审计：每个变更路由都必须调用 checkOrigin ────────────────────────────────
const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, "src", "app", "api");

// 显式豁免：由提供方签名鉴权的服务端到服务端 webhook（非浏览器请求，Origin 不适用）。
const CHECK_ORIGIN_EXEMPT = ["src/app/api/billing/notify/route.ts"];

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.isFile() && entry.name === "route.ts" ? [full] : [];
  });
}
const rel = (f: string) => path.relative(repoRoot, f).replace(/\\/g, "/");

describe("CSRF 结构审计：变更路由必须 checkOrigin (itest7 P3)", () => {
  it("每个导出 POST/PUT/PATCH/DELETE 的 route.ts 都包含 checkOrigin（webhook 除外）", () => {
    const offenders = routeFiles(apiRoot)
      .filter((file) => {
        const src = fs.readFileSync(file, "utf8");
        const mutating = /export async function (POST|PUT|PATCH|DELETE)\b/.test(src);
        // itest8 P3：匹配【调用】checkOrigin(...) 而非仅 import——`includes("checkOrigin")` 会把只
        // import 未调用的路由误判为已防护（假阴性）。要求出现真正的调用形式 checkOrigin( 。
        const callsCheckOrigin = /checkOrigin\s*\(/.test(src);
        return mutating && !callsCheckOrigin && !CHECK_ORIGIN_EXEMPT.includes(rel(file));
      })
      .map(rel)
      .sort();
    expect(offenders).toEqual([]);
  });
});
