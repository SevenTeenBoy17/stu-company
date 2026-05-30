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
  // When CRON_SECRET is set, require it (Vercel Cron sends it). If unset (local),
  // allow so the endpoint can be exercised in development.
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
