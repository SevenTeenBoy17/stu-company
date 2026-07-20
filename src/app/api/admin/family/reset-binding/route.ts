import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { isSuperAdmin } from "@/lib/auth-roles";
import { findUserByEmail, resetGuardianBindingForStudent } from "@/lib/db/repo";

// itest10 #12: admin remediation for a mis-claimed guardian binding. The
// 1-student↔1-parent guard refuses a second guardian code once claimed, so a
// wrong-account claim would lock the student out forever — this is the "联系管理员"
// lever that error message promises. Super-admin only, CSRF-guarded.
const schema = z
  .object({
    studentUserId: z.string().trim().min(1).max(64).optional(),
    studentEmail: z.string().trim().email().max(255).optional(),
  })
  .refine((value) => Boolean(value.studentUserId || value.studentEmail), {
    message: "需要提供学生账号 ID 或邮箱。",
  });

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("admin");
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user)) {
    return apiError("forbidden", "只有超级管理员可以解除家长绑定。", 403);
  }

  try {
    const body = schema.parse(await request.json());
    let studentUserId = body.studentUserId;
    if (!studentUserId && body.studentEmail) {
      const student = await findUserByEmail(body.studentEmail.toLowerCase());
      if (!student || student.role !== "student") {
        return apiError("not_found", "未找到该学生账号。", 404);
      }
      studentUserId = student.id;
    }

    const result = await resetGuardianBindingForStudent(studentUserId as string);
    return NextResponse.json({
      message: "已解除该学生的家长绑定，学生可重新生成绑定邀请码。",
      ...result,
    });
  } catch (error) {
    return handleRouteError(error, "解除家长绑定失败，请稍后再试。");
  }
}
