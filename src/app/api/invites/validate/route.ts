import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { validateInviteCode } from "@/lib/db/repo";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";

const inviteQuerySchema = z.object({
  code: z.string().min(6),
});

export async function GET(request: Request) {
  try {
    // itest7 P2：本路由匿名可访问，若不限流即成为在线邀请码枚举预言机（种子码为低熵人类可读）。
    // 每次请求都消耗（枚举无论命中与否都发请求），与 register-by-invite 的 IP 维度对齐。
    const limited = rateLimit(rateLimitKey("invite-validate", undefined, request), 30, 60_000 * 10);
    if (!limited.ok) {
      return apiError("invalid_input", "校验过于频繁，请稍后再试。", 429);
    }

    const { searchParams } = new URL(request.url);
    const query = inviteQuerySchema.parse({
      code: searchParams.get("code") ?? "",
    });
    const result = await validateInviteCode(query.code);

    if (!result.valid || !result.invite) {
      return apiError("invalid_input", result.reason ?? "邀请码无效。", 400);
    }

    // itest7 P2：只回传客户端表单所需的最小字段（valid + role）。绝不透传整条邀请记录——
    // 其 id/createdBy(内部用户 id)/label/usesRemaining/expiresAt 属对匿名者的多余信息泄露。
    return NextResponse.json({ valid: true, role: result.invite.role });
  } catch (error) {
    return handleRouteError(error, "邀请码校验失败。");
  }
}
