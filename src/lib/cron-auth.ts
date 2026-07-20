import crypto from "node:crypto";

import { apiError } from "@/lib/api-response";
import { env } from "@/lib/env";

/**
 * 常量时间比较两个字符串（itest7 P3）：普通 `!==` 在首个不等字节即短路，可被攻击者用计时差
 * 逐字节还原 Bearer 令牌。先比长度（长度本身非敏感），再用 crypto.timingSafeEqual 定时比较。
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Cron Bearer 鉴权（weekly-report / recompute-leaderboard 共用）。生产必配 CRON_SECRET；
 * 用常量时间比较避免令牌计时预言机。返回错误响应=拒绝，返回 null=放行。
 */
export function authorizeCron(request: Request): ReturnType<typeof apiError> | null {
  // 生产强制：未配密钥即拒绝，绝不暴露无鉴权的 cron 端点（会被无限触发写放大/邮件轰炸）。
  if (process.env.NODE_ENV === "production" && !env.CRON_SECRET) {
    return apiError("service_unavailable", "Cron 未配置密钥，已拒绝。", 503);
  }
  if (env.CRON_SECRET) {
    const authorization = request.headers.get("authorization") ?? "";
    if (!timingSafeEqualStr(authorization, `Bearer ${env.CRON_SECRET}`)) {
      return apiError("unauthorized", "无效的 Cron 凭证。", 401);
    }
  }
  return null;
}
