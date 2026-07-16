import { afterEach, describe, expect, it, vi } from "vitest";

// itest6 R3 P3-5: 领域校验错误(DomainError)是业务规则拒绝，不是 DB 故障。它必须：
//  (1) 仍是 Error 子类且 message 原样 —— handleRouteError 靠 `instanceof Error ? message : fallback`
//      + 消息内容正则映射状态码，DomainError 一旦不 extends Error 或改 message，路由行为就变(回归护栏)。
//  (2) 在 withDbExecutor 的 catch 里被 `instanceof DomainError` 提前冒泡，绝不走 logFallback
//      (不记 query_failed、不发 [repo.fallback] SLI)，而真 infra Error 仍照常记录(对照组)。

// 可变持有器：让被 mock 的 DB 在不同用例里抛出不同错误（领域 vs 基础设施），
// 并可注入一个与主库不同的 direct 兜底库桩（模拟生产 Supabase pooler 拓扑，覆盖 withDb 外层重试路径）。
const holder: {
  throwFn: () => never;
  directDb: unknown;
  directTouched: boolean;
} = {
  throwFn: () => {
    throw new Error("simulated DB query failure");
  },
  directDb: null, // 默认 null → withDb 外层直接冒泡；单个用例可设为独立桩以触发/验证重试分支
  directTouched: false,
};

vi.mock("@/lib/db/client", () => ({
  isDatabaseConfigured: () => true,
  // 每次属性访问(db.select / db.update ...)都触发 holder.throwFn —— 模拟 dbFn 内抛错。
  getDb: () => new Proxy({}, { get: () => () => holder.throwFn() }),
  getDirectFallbackDb: () => holder.directDb, // 默认 null；注入独立桩即模拟 pooler 直连兜底
  getSupabaseDirectFallbackUrl: () => null,
}));

async function loadRepo(nodeEnv: "test" | "development" | "production") {
  // logFallback 在 NODE_ENV==="test" 时早退不 warn；且非 production 时内存兜底默认开启，读失败会
  // 静默返回 null 而非冒泡。故断言 [repo.fallback]/冒泡的用例用 "production"（此时 client 已被 mock、
  // repo 不会拉 env，因此不触发 SESSION_SECRET 校验，与 repo-fallback.audit 同法）；只调 handleRouteError
  // 的纯路由用例用 "test"（要 import api-response→env，production 会强制 SESSION_SECRET）。
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("ALLOW_MEMORY_FALLBACK", ""); // 关显式兜底旗标；production 下读失败即冒泡
  vi.resetModules();
  return import("@/lib/db/repo");
}

describe("DomainError (P3-5 — 领域错误不误报 fallback SLI)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    holder.directDb = null;
    holder.directTouched = false;
    holder.throwFn = () => {
      throw new Error("simulated DB query failure");
    };
  });

  it("extends Error, message 原样保留(handleRouteError 兼容铰链)", async () => {
    const { DomainError } = await loadRepo("test");
    const e = new DomainError("本回合已经提交过预测。");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("DomainError");
    expect(e.message).toBe("本回合已经提交过预测。");
  });

  it("经 handleRouteError：DomainError 与同 message 的普通 Error 路由完全一致", async () => {
    const { DomainError } = await loadRepo("test");
    const { handleRouteError } = await import("@/lib/api-response");
    const msg = "这张卡牌已经被领取。"; // 命中 conflict 正则 → 409
    const domainRes = handleRouteError(new DomainError(msg), "默认失败提示");
    const plainRes = handleRouteError(new Error(msg), "默认失败提示");
    const domainBody = (await domainRes.json()) as { error: string; message: string };
    const plainBody = (await plainRes.json()) as { error: string; message: string };
    // 关键契约：换成 DomainError 不改变 handleRouteError 的状态码与响应体
    expect(domainRes.status).toBe(plainRes.status);
    expect(domainBody).toEqual(plainBody);
    expect(domainRes.status).toBe(409);
    expect(domainBody.message).toBe(msg); // message 路径，非 fallbackMessage
  });

  it("DB 路径抛出的 DomainError 冒泡且【不】记 [repo.fallback]", async () => {
    const { DomainError, findUserById } = await loadRepo("production");
    holder.throwFn = () => {
      throw new DomainError("领域拒绝：仅测试");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(findUserById("anyone")).rejects.toBeInstanceOf(DomainError);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("[repo.fallback]"));
  });

  it("对照：真 infra Error 仍记 [repo.fallback](守卫没有误伤真告警)", async () => {
    const { findUserById } = await loadRepo("production");
    holder.throwFn = () => {
      throw new Error("simulated DB query failure");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(findUserById("anyone")).rejects.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[repo.fallback]"));
  });

  it("生产 pooler 拓扑：DomainError 不触发 direct_supabase 重试、不打印 [repo.fallback]（itest7 P2 外层守卫）", async () => {
    const { DomainError, findUserById } = await loadRepo("production");
    // 注入一个与主库【不同】的 direct 兜底桩：若外层 catch 缺 DomainError 守卫，就会打印
    // [repo.fallback] retry=direct_supabase 并对着它把整段 dbFn 重跑一遍（touch 该桩）。
    holder.directDb = new Proxy(
      {},
      {
        get: () => {
          holder.directTouched = true;
          return () => holder.throwFn();
        },
      },
    );
    holder.throwFn = () => {
      throw new DomainError("领域拒绝：仅测试");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(findUserById("anyone")).rejects.toBeInstanceOf(DomainError);
    // 外层守卫生效：不发 SLI、绝不重跑事务（direct 桩从未被访问）。
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("[repo.fallback]"));
    expect(holder.directTouched).toBe(false);
  });

  it("对照：真 infra Error 在 pooler 拓扑下【会】走 direct_supabase 重试（守卫没有误伤真兜底）", async () => {
    const { findUserById } = await loadRepo("production");
    holder.directDb = new Proxy(
      {},
      {
        get: () => {
          holder.directTouched = true;
          return () => holder.throwFn();
        },
      },
    );
    holder.throwFn = () => {
      throw new Error("simulated DB query failure");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(findUserById("anyone")).rejects.toThrow();
    // infra 错误照旧：打印 retry SLI 并对 direct 桩重跑（证明守卫只拦 DomainError）。
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("retry=direct_supabase"));
    expect(holder.directTouched).toBe(true);
  });
});
