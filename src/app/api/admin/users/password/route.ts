import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { isSuperAdmin } from "@/lib/auth-roles";
import { updateUserPassword } from "@/lib/db/repo";

const passwordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8).max(72),
});


export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  if (!isSuperAdmin(auth.user)) {
    return apiError("forbidden", "只有超级管理员可以重置账号密码。", 403);
  }

  try {
    const body = passwordSchema.parse(await request.json());
    const user = await updateUserPassword(body.userId, body.password);
    return NextResponse.json({
      message: "密码已更新，目标账号的旧会话也已失效。",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tokenVersion: user.tokenVersion ?? 0,
      },
    });
  } catch (error) {
    return handleRouteError(error, "密码更新失败，请稍后再试。");
  }
}
