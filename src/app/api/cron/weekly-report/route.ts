import { NextResponse } from "next/server";

import { authorizeCron } from "@/lib/cron-auth";
import { listPremiumFamilyDigests } from "@/lib/db/repo";
import { sendEmail, weeklyReportEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron weekly parent report (Premium weeklyParentEmail perk). Scheduled
 * in vercel.json; Vercel sends `Authorization: Bearer $CRON_SECRET`. Emails each
 * Premium family owner a digest of their student(s) via Resend.
 */
export async function GET(request: Request) {
  const denied = authorizeCron(request); // 生产必配 + 常量时间比较（itest7 P3）
  if (denied) return denied;

  const digests = await listPremiumFamilyDigests();
  let sent = 0;
  for (const digest of digests) {
    const mail = weeklyReportEmail(digest);
    const delivery = await sendEmail({ to: digest.ownerEmail, subject: mail.subject, html: mail.html });
    if (delivery.delivered) sent += 1;
  }

  return NextResponse.json({ processed: digests.length, sent });
}
