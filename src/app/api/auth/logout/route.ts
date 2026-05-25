import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { clearSession } from "@/lib/auth";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ message: "已退出登录。" });
  } catch (error) {
    return handleRouteError(error, "退出登录失败。");
  }
}
