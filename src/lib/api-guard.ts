import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { findUserById } from "@/lib/store";
import type { Role } from "@/lib/types";

export async function requireUser(requiredRole?: Role) {
  const session = await readSession();
  if (!session) {
    return { error: NextResponse.json({ error: "请先登录后再访问这个接口。" }, { status: 401 }) };
  }

  const user = findUserById(session.userId);
  if (!user) {
    return { error: NextResponse.json({ error: "会话用户不存在。" }, { status: 401 }) };
  }

  if (requiredRole && user.role !== requiredRole) {
    return { error: NextResponse.json({ error: "当前账号没有该接口权限。" }, { status: 403 }) };
  }

  return { user };
}
