import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { validateInviteCode } from "@/lib/db/repo";

const inviteQuerySchema = z.object({
  code: z.string().min(6),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = inviteQuerySchema.parse({
      code: searchParams.get("code") ?? "",
    });
    const result = await validateInviteCode(query.code);

    if (!result.valid) {
      return apiError("invalid_input", result.reason ?? "邀请码无效。", 400);
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "邀请码校验失败。");
  }
}
