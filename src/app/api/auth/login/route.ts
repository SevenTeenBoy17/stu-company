import { NextResponse } from "next/server";
import { z } from "zod";

import { persistSession } from "@/lib/auth";
import { authenticateUser, roleHomePath } from "@/lib/store";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await authenticateUser(body.email, body.password);

    if (!user) {
      return NextResponse.json({ error: "邮箱或密码不正确。" }, { status: 401 });
    }

    await persistSession({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    return NextResponse.json({
      redirectTo: roleHomePath(user.role),
      message: "登录成功。",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登录失败。" },
      { status: 400 },
    );
  }
}
