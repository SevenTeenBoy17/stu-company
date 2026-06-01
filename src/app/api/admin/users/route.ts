import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { createAdminManagedUser, listAdminUsers } from "@/lib/db/repo";

const roleSchema = z.enum(["student", "teacher", "parent", "admin"]);
const subscriptionSchema = z.enum(["free", "standard", "premium"]);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(32),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  role: roleSchema.default("student"),
  title: z.string().trim().max(120).optional(),
  subscriptionTier: subscriptionSchema.default("free"),
  trialDays: z.number().int().min(0).max(90).nullable().optional(),
  subscriptionDays: z.number().int().min(0).max(730).nullable().optional(),
});

function isSuperAdmin(user: { id: string; email: string }) {
  return user.id === "superadmin" || user.email.toLowerCase() === "superadmin";
}

export async function GET(request: Request) {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const role = url.searchParams.get("role") ?? "all";
    const subscription = url.searchParams.get("subscription") ?? "all";
    const users = await listAdminUsers({
      query: url.searchParams.get("query") ?? undefined,
      role: role === "all" || roleSchema.safeParse(role).success ? (role as "all" | z.infer<typeof roleSchema>) : "all",
      subscription:
        subscription === "all" || subscription === "trial" || subscriptionSchema.safeParse(subscription).success
          ? (subscription as "all" | "trial" | z.infer<typeof subscriptionSchema>)
          : "all",
    });

    return NextResponse.json({ users, canWrite: isSuperAdmin(auth.user) });
  } catch (error) {
    return handleRouteError(error, "无法读取账号列表。");
  }
}

export async function POST(request: Request) {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user)) {
    return apiError("forbidden", "只有超级管理员可以创建账号。", 403);
  }

  try {
    const body = createUserSchema.parse(await request.json());
    const user = await createAdminManagedUser({ ...body, email: body.email.toLowerCase() });
    return NextResponse.json({ message: "账号已创建。", user }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "账号创建失败，请检查邮箱是否已注册。");
  }
}
