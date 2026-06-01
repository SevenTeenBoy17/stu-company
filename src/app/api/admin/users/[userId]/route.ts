import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { updateAdminManagedUser } from "@/lib/db/repo";

const roleSchema = z.enum(["student", "teacher", "parent", "admin"]);
const subscriptionSchema = z.enum(["free", "standard", "premium"]);

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(32).optional(),
  title: z.string().trim().max(120).optional(),
  role: roleSchema.optional(),
  subscriptionTier: subscriptionSchema.optional(),
  trialDays: z.number().int().min(0).max(90).nullable().optional(),
  subscriptionDays: z.number().int().min(0).max(730).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
});

function isSuperAdmin(user: { id: string; email: string }) {
  return user.id === "superadmin" || user.email.toLowerCase() === "superadmin";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user)) {
    return apiError("forbidden", "只有超级管理员可以修改账号配置。", 403);
  }

  try {
    const { userId } = await params;
    const body = updateUserSchema.parse(await request.json());
    const user = await updateAdminManagedUser(userId, body);
    return NextResponse.json({ message: "账号配置已更新。", user });
  } catch (error) {
    return handleRouteError(error, "账号配置更新失败。");
  }
}
