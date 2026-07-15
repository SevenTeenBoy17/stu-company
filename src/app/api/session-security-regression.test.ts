// @vitest-environment node

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, "src", "app", "api");

const allowedDirectReadSessionRoutes = [
  "src/app/api/ai/chat/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/billing/status/route.ts",
];

function routeFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(fullPath);
      return entry.isFile() && entry.name === "route.ts" ? [fullPath] : [];
    });
}

function sourceWithoutComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
}

function rel(file: string) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function readApiRoute(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("API session invalidation guard", () => {
  it("keeps direct readSession() usage limited to reviewed optional-session exceptions", () => {
    const routesUsingReadSession = routeFiles(apiRoot)
      .filter((file) => sourceWithoutComments(fs.readFileSync(file, "utf8")).includes("readSession("))
      .map(rel)
      .sort();

    expect(routesUsingReadSession).toEqual([...allowedDirectReadSessionRoutes].sort());
  });

  it("requires every reviewed readSession() exception to keep its compensating control", () => {
    const aiChatRoute = readApiRoute("src/app/api/ai/chat/route.ts");
    expect(aiChatRoute).toContain("await findUserById(session.userId)");
    expect(aiChatRoute).toMatch(/\(user\.tokenVersion \?\? 0\) !== \(session\.tv \?\? 0\)/);
    expect(aiChatRoute).toContain('apiError("unauthorized"');

    const billingStatusRoute = readApiRoute("src/app/api/billing/status/route.ts");
    expect(billingStatusRoute).toContain("if (!session)");
    expect(billingStatusRoute).toContain("const auth = await requireUser()");
    expect(billingStatusRoute).toContain("if (auth.error) return auth.error");

    const logoutRoute = readApiRoute("src/app/api/auth/logout/route.ts");
    expect(logoutRoute).toContain("await clearSession()");
    expect(logoutRoute).toContain("await bumpTokenVersion(session.userId)");
  });
});
