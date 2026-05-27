import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { persistSession } from "@/lib/auth";
import { authenticateUser, roleHomePath } from "@/lib/db/repo";

const loginSchema = z.object({
  email: z.string().trim().min(3).max(255),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const body = loginSchema.parse(await request.json());
    const user = await authenticateUser(body.email, body.password);

    if (!user) {
      return apiError("unauthorized", "邮箱或密码不正确。", 401);
    }

    await persistSession({
      userId: user.id,
      role: user.role,
      email: user.email,
      classroomId: user.classroomId ?? null,
      tv: user.tokenVersion ?? 0,
    });

    return NextResponse.json({
      redirectTo: roleHomePath(user.role),
      message: "登录成功。",
    });
  } catch (error) {
    return handleRouteError(error, "登录失败。");
  }
}
