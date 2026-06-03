import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { listAiSessionsForUser } from "@/lib/db/repo";
import { rlsClaimsForUser, withUserRls } from "@/lib/db/rls-context";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const sessions = (
      await withUserRls(rlsClaimsForUser(auth.user), () => listAiSessionsForUser(auth.user.id))
    ).map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      mode: session.mode,
    }));

    return NextResponse.json({
      sessions,
      viewer: {
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.role,
      },
    });
  } catch (error) {
    return handleRouteError(error, "无法读取 KeyAI 历史会话。");
  }
}
