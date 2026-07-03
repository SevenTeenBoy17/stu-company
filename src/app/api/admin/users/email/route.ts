import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { updateUserEmail } from "@/lib/db/repo";

const emailSchema = z.object({
  userId: z.string().min(1),
  email: z
    .string()
    .trim()
    .max(255)
    .refine(
      (value) =>
        value.toLowerCase() === "superadmin" || z.string().email().safeParse(value).success,
      "请输入有效邮箱，超级管理员账号可保留为 superadmin。",
    ),
});

function isSuperAdmin(user: { id: string; email: string }) {
  return user.id === "superadmin" || user.email.toLowerCase() === "superadmin";
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  if (!isSuperAdmin(auth.user)) {
    return apiError("forbidden", "只有超级管理员可以修改账号邮箱。", 403);
  }

  try {
    const body = emailSchema.parse(await request.json());
    const user = await updateUserEmail(body.userId, body.email.toLowerCase());
    return NextResponse.json({
      message: "邮箱已更新，目标账号的旧会话也已失效。",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tokenVersion: user.tokenVersion ?? 0,
      },
    });
  } catch (error) {
    return handleRouteError(error, "邮箱更新失败，请稍后再试。");
  }
}
