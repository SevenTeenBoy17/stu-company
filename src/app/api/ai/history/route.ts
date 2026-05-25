import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { listAiSessionsForUser } from "@/lib/store";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const sessions = listAiSessionsForUser(auth.user.id).map((session) => ({
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
}
