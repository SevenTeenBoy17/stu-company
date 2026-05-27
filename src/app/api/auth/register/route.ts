import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { persistSession } from "@/lib/auth";
import { registerUserByEmail, roleHomePath } from "@/lib/db/repo";
import { rateLimit, rateLimitKey, buildRateLimitMessage } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "昵称至少需要 2 个字符。").max(16, "昵称最多 16 个字符。"),
  email: z.string().trim().email("请输入有效的邮箱地址。").max(255),
  password: z
    .string()
    .min(8, "密码至少 8 位。")
    .regex(/[a-zA-Z]/, "密码需包含至少一个字母。")
    .regex(/\d/, "密码需包含至少一个数字。"),
  inviteCode: z.string().min(6).optional(),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const rlKey = rateLimitKey("register", undefined, request);
    const rl = rateLimit(rlKey, 5, 60_000 * 10);
    if (!rl.ok) {
      return apiError("invalid_input", buildRateLimitMessage(rl), 429);
    }

    const body = registerSchema.parse(await request.json());
    const user = await registerUserByEmail(body);

    await persistSession({
      userId: user.id,
      role: user.role,
      email: user.email,
      classroomId: user.classroomId ?? null,
      tv: user.tokenVersion ?? 0,
    });

    return NextResponse.json({
      redirectTo: roleHomePath(user.role),
      message: "注册成功，欢迎加入 Mr.Brown 经济沙盘！",
    });
  } catch (error) {
    return handleRouteError(error, "注册失败。");
  }
}
