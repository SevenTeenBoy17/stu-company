import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api-response";
import { persistSession } from "@/lib/auth";
import { registerUserByInvite, roleHomePath } from "@/lib/db/repo";

const registerSchema = z.object({
  inviteCode: z.string().min(6),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const user = await registerUserByInvite(body);

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
