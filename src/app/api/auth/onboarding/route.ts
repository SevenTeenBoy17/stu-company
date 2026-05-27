import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { markOnboardingCompleted } from "@/lib/db/repo";

export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  await markOnboardingCompleted(auth.user.id);
  return NextResponse.json({ ok: true });
}
