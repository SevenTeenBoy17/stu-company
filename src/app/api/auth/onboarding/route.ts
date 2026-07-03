import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { checkOrigin } from "@/lib/api-response";
import { markOnboardingCompleted } from "@/lib/db/repo";

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  await markOnboardingCompleted(auth.user.id);
  return NextResponse.json({ ok: true });
}
