import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { checkOrigin, handleRouteError } from "@/lib/api-response";
import { markOnboardingCompleted } from "@/lib/db/repo";

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  // itest8 P3：markOnboardingCompleted 首次执行(DB 故障/写兜底冒泡)若抛出，无 try/catch 会返 500
  // 裸栈而非统一的 {error,message}。包起来交给 handleRouteError，与其它写路由一致。
  try {
    await markOnboardingCompleted(auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "无法保存引导状态，请稍后再试。");
  }
}
