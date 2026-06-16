import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { findOrCreateSchool, getRankProfile, getSchoolById, upsertRankProfile } from "@/lib/db/repo";
import { rlsClaimsForUser, withUserRls } from "@/lib/db/rls-context";
import { isValidCity, isValidProvince } from "@/lib/leaderboard/regions";
import { sanitizeDisplayText } from "@/lib/leaderboard/school-normalize";
import { recomputePowerForUser } from "@/lib/leaderboard/service";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  provinceCode: z.string().trim().min(2).max(8),
  cityCode: z.string().trim().min(2).max(8),
  schoolName: z.string().trim().min(2).max(40),
  alias: z.string().trim().min(2).max(20),
  visibility: z.enum(["public", "school_only", "hidden"]).default("public"),
  // Self-attested guardian consent (decision 3). Until true, the player is not
  // shown on any board.
  consent: z.boolean().default(false),
});

/** GET — the caller's current rank profile (null before onboarding). */
export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;
  const profile = await withUserRls(rlsClaimsForUser(auth.user), () =>
    getRankProfile(auth.user.id),
  );
  // Resolve the school name so the edit form can pre-fill it (#10 audit: the
  // profile must be editable, including privacy/consent, after creation).
  const school = profile ? await getSchoolById(profile.schoolId) : null;
  return NextResponse.json({ profile, schoolName: school?.name ?? "" });
}

/** POST — join / update the leaderboard with required school + region. */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("invalid_input", "请完整填写学校、地区与昵称。", 400);
    }
    const { provinceCode, cityCode, visibility, consent } = parsed.data;

    if (!isValidProvince(provinceCode) || !isValidCity(provinceCode, cityCode)) {
      return apiError("invalid_input", "请选择有效的省份与城市。", 400);
    }

    // Harden the public display text (strip control/zero-width/bidi chars) before
    // it lands on a board seen by other minors; re-check length post-sanitize.
    const schoolName = sanitizeDisplayText(parsed.data.schoolName);
    const alias = sanitizeDisplayText(parsed.data.alias);
    if (alias.length < 2 || schoolName.length < 2) {
      return apiError("invalid_input", "学校或昵称包含无效字符，请重新填写。", 400);
    }

    const school = await findOrCreateSchool({
      name: schoolName,
      provinceCode,
      cityCode,
      createdBy: auth.user.id,
    });
    const profile = await upsertRankProfile({
      userId: auth.user.id,
      provinceCode,
      cityCode,
      schoolId: school.id,
      alias,
      visibility,
      consent: consent ? 1 : 0,
    });

    // Seed an initial power so the card isn't empty after onboarding.
    await recomputePowerForUser(auth.user.id).catch(() => {});

    return NextResponse.json({
      profile,
      school: { id: school.id, name: school.name },
      message: consent ? "已加入财商战力排行榜。" : "信息已保存。获得家长同意后即可上榜。",
    });
  } catch (error) {
    return handleRouteError(error, "保存排行榜信息失败，请稍后再试。");
  }
}
