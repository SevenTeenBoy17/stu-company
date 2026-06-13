import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { persistSession } from "@/lib/auth";
import { INVITE_CODE_FORMAT_MESSAGE, INVITE_CODE_PATTERN } from "@/lib/auth-validation";
import { registerUserByInvite, roleHomePath } from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

const registerSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(6, "邀请码至少 6 位。")
    .max(40, "邀请码最多 40 位。")
    .regex(INVITE_CODE_PATTERN, INVITE_CODE_FORMAT_MESSAGE),
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const body = registerSchema.parse(await request.json());
    const rl = rateLimit(rateLimitKey("register-invite", undefined, request), 5, 60_000 * 10);
    if (!rl.ok) {
      return apiError("invalid_input", buildRateLimitMessage(rl), 429);
    }

    const user = await registerUserByInvite({ ...body, email: body.email.toLowerCase() });

    await persistSession({
      userId: user.id,
      role: user.role,
      email: user.email,
      classroomId: user.classroomId ?? null,
      tv: user.tokenVersion ?? 0,
    });

    return NextResponse.json({
      redirectTo: roleHomePath(user.role),
      message: "邀请码注册成功。",
    });
  } catch (error) {
    return handleRouteError(error, "注册失败。");
  }
}
