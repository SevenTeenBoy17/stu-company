import { NextResponse } from "next/server";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { getAiSessionById } from "@/lib/db/repo";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const { sessionId } = await context.params;
    const session = await getAiSessionById(sessionId, auth.user.id);
    if (!session) {
      return apiError("not_found", "当前会话不存在或无权访问。", 404);
    }

    return NextResponse.json({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      mode: session.mode,
      messages: session.messages,
    });
  } catch (error) {
    return handleRouteError(error, "无法读取 KeyAI 历史会话。");
  }
}
