import { NextResponse } from "next/server";

import { checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { getOrCreateGuardianInviteForStudent } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

/**
 * LC10h P1 (LC-11): mint (or reuse) a guardian invite code the student can hand
 * to a parent. The parent registers with this code, which binds them via the
 * carried `studentLinkId` — unlocking family Premium sharing, adult-proxy
 * purchase, and the weekly parent report for organically-registered users.
 * Idempotent, so calling it repeatedly returns the same active code.
 */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const { invite, reused } = await getOrCreateGuardianInviteForStudent(auth.user.id);
    return NextResponse.json({
      code: invite.code,
      expiresAt: invite.expiresAt,
      reused,
      message: reused ? "已有一个有效的家长绑定邀请码。" : "家长绑定邀请码已生成。",
    });
  } catch (error) {
    return handleRouteError(error, "生成家长绑定邀请码失败。");
  }
}
