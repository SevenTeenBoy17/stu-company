import { describe, expect, it } from "vitest";

import { handleRouteError } from "@/lib/api-response";

describe("handleRouteError", () => {
  it("maps the client-side query-race 'timed out' error to 503 db_unavailable — never leaks the raw internal message", async () => {
    // Regression: withQueryTimeout throws "<fn> timed out after Nms" ("timed out",
    // not "timeout"). The old regex used /timeout/ and missed it, so the raw
    // English message leaked to a student on the learning-growth board onboarding screen.
    const res = handleRouteError(
      new Error("findOrCreateSchool timed out after 5000ms"),
      "保存排行榜信息失败，请稍后再试。",
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("db_unavailable");
    expect(body.message).toBe("数据库暂时不可用，请稍后再试。");
    expect(body.message).not.toMatch(/timed out|findOrCreateSchool|5000ms/);
  });

  it("maps other database/connection faults to 503", async () => {
    for (const msg of [
      "connection refused",
      "postgres ECONNREFUSED 1.2.3.4:5432",
      "getaddrinfo ENOTFOUND db.example.com",
      "canceling statement due to statement timeout",
      "数据库连接失败",
    ]) {
      const res = handleRouteError(new Error(msg), "fallback");
      expect(res.status, msg).toBe(503);
    }
  });

  it("maps duplicate/unique violations to 409 conflict", async () => {
    const res = handleRouteError(new Error('duplicate key value violates unique constraint'), "x");
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("conflict");
  });

  it("重复领取映射为 409 conflict 并回传真实中文消息（非 400）", async () => {
    const res = handleRouteError(new Error("这个装饰奖励已经领取过了。"), "兜底");
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("conflict");
    expect(body.message).toContain("已经领取");
  });

  it("falls back to 400 invalid_input for unrelated errors", async () => {
    const res = handleRouteError(new Error("某业务校验未通过"), "兜底提示");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_input");
  });

  it("itest8 P2：畸形 JSON 的 SyntaxError 收成中文 invalid_input，不回显英文原生错误/原始输入", async () => {
    // request.json() 对畸形体抛的正是这种 message。
    const res = handleRouteError(
      new SyntaxError(`Unexpected token 'o', "not json {{{" is not valid JSON`),
      "兜底",
    );
    const body = (await res.json()) as { error: string; message: string };
    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_input");
    expect(body.message).toBe("请求格式不正确，请检查后重试。");
    expect(body.message).not.toContain("Unexpected token"); // 不泄露英文原生错误
    expect(body.message).not.toContain("not json"); // 不回显原始输入
  });
});
