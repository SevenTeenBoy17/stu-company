import { afterEach, describe, expect, it, vi } from "vitest";

// AUDIT R1 (see docs/audit-repo-2026-06-03.md): withDb's `query_failed` branch
// must RE-THROW when ALLOW_MEMORY_FALLBACK is off (the production default) rather
// than silently returning in-memory store data. Otherwise a failed DB *write*
// looks like success and a student's trade / progress is silently lost.
//
// Failure-first intent: this pins the production-safe contract so any regression
// that re-widens the silent fallback (e.g. defaulting it on) fails CI.

// Make the DB look "configured" but explode on every query.
vi.mock("@/lib/db/client", () => ({
  isDatabaseConfigured: () => true,
  getDb: () =>
    new Proxy(
      {},
      {
        get() {
          throw new Error("simulated DB query failure");
        },
      },
    ),
}));

async function loadRepoWithEnv(nodeEnv: string, allow: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("ALLOW_MEMORY_FALLBACK", allow);
  vi.resetModules(); // re-evaluate the ALLOW_MEMORY_FALLBACK const under the stubbed env
  return import("@/lib/db/repo");
}

describe("repo withDb fallback contract (R1 audit)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("RE-THROWS a DB error when memory fallback is disabled (production-safe)", async () => {
    const repo = await loadRepoWithEnv("production", ""); // not "true" -> disabled in prod
    // A failing DB read must surface as an error, never a silent store fallback.
    await expect(repo.findUserById("anyone")).rejects.toThrow();
  });

  it("falls back to the in-memory store when fallback is enabled (offline demo)", async () => {
    const repo = await loadRepoWithEnv("test", ""); // != production -> fallback enabled
    // DB throws -> store fallback (no such user -> null), and does NOT throw.
    await expect(repo.findUserById("definitely-not-a-seed-user")).resolves.toBeNull();
  });

  it("a WRITE never silently falls back even when fallback is enabled (P2 — no lost data)", async () => {
    const repo = await loadRepoWithEnv("test", ""); // fallback enabled -> reads WOULD fall back
    // bumpTokenVersion is a WRITE: a failed DB write must surface, not fake success.
    await expect(repo.bumpTokenVersion("any-user")).rejects.toThrow();
  });
});
