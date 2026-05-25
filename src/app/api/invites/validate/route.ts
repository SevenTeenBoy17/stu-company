import { NextResponse } from "next/server";

import { validateInviteCode } from "@/lib/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") ?? "";
  const result = validateInviteCode(code);

  if (!result.valid) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
