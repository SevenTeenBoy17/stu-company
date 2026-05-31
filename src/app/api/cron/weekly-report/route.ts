import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { listPremiumFamilyDigests } from "@/lib/db/repo";
import { sendEmail, weeklyReportEmail } from "@/lib/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron weekly parent report (Premium weeklyParentEmail perk). Scheduled
 * in vercel.json; Vercel sends `Authorization: Bearer $CRON_SECRET`. Emails each
 * Premium family owner a digest of their student(s) via Resend.
 */
export async function GET(request: Request) {
  // In production CRON_SECRET is mandatory — never expose this endpoint
  // unauthenticated. Locally it may be unset for manual testing.
  if (process.env.NODE_ENV === "production" && !env.CRON_SECRET) {
    return apiError("service_unavailable", "Cron 未配置密钥，已拒绝。", 503);
  }
  if (env.CRON_SECRET) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${env.CRON_SECRET}`) {
      return apiError("unauthorized", "无效的 Cron 凭证。", 401);
    }
  }

  const digests = await listPremiumFamilyDigests();
  let sent = 0;
  for (const digest of digests) {
    const mail = weeklyReportEmail(digest);
    const delivery = await sendEmail({ to: digest.ownerEmail, subject: mail.subject, html: mail.html });
    if (delivery.delivered) sent += 1;
  }

  return NextResponse.json({ processed: digests.length, sent });
}
