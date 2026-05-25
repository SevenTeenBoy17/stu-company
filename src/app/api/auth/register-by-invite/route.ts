import { NextResponse } from "next/server";
import { z } from "zod";

import { persistSession } from "@/lib/auth";
import { registerUserByInvite, roleHomePath } from "@/lib/store";

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
    });

    return NextResponse.json({
      redirectTo: roleHomePath(user.role),
      message: "邀请码注册成功。",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败。" },
      { status: 400 },
    );
  }
}
