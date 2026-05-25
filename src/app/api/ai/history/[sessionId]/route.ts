import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getAiSessionById } from "@/lib/store";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { sessionId } = await context.params;
  const session = getAiSessionById(sessionId, auth.user.id);
  if (!session) {
    return NextResponse.json({ error: "当前会话不存在或无权访问。" }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    mode: session.mode,
    messages: session.messages,
  });
}
