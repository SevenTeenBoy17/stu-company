import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { clearSession, readSession } from "@/lib/auth";
import { bumpTokenVersion } from "@/lib/db/repo";

export async function POST() {
  try {
    const session = await readSession();
    await clearSession();
    // H2: server-side revoke — any cookie still in the wild now fails the
    // token_version check in requireUser even before expiry.
    if (session) {
      try {
        await bumpTokenVersion(session.userId);
      } catch {
        // Logout should still succeed if the token-version bump fails (e.g.
        // DB down). The client cookie has already been cleared.
      }
    }
    return NextResponse.json({ message: "已退出登录。" });
  } catch (error) {
    return handleRouteError(error, "退出登录失败。");
  }
}
