import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import {
  addFamilyMember,
  findUserByEmail,
  listFamilyMembers,
  removeFamilyMember,
} from "@/lib/db/repo";

const addSchema = z
  .object({
    studentEmail: z.string().trim().email().optional(),
    studentUserId: z.string().min(1).optional(),
  })
  .refine((data) => data.studentEmail || data.studentUserId, "请提供学生邮箱或账号 ID。");

const removeSchema = z.object({ studentUserId: z.string().min(1) });

/** GET — list the Premium parent's family members. */
export async function GET() {
  const auth = await requireUser("parent");
  if (auth.error) return auth.error;
  const members = await listFamilyMembers(auth.user.id);
  return NextResponse.json({ members });
}

/** POST — add a linked student to the family (seat cap = Premium maxStudents). */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("parent");
  if (auth.error) return auth.error;

  try {
    const body = addSchema.parse(await request.json());
    let studentUserId = body.studentUserId;
    if (!studentUserId && body.studentEmail) {
      const student = await findUserByEmail(body.studentEmail.toLowerCase());
      if (!student) return apiError("not_found", "找不到该学生账号。", 404);
      studentUserId = student.id;
    }
    const member = await addFamilyMember(auth.user.id, studentUserId!);
    return NextResponse.json({ member, message: "已加入家庭组，孩子将继承高级版权益。" });
  } catch (error) {
    return handleRouteError(error, "加入家庭组失败。");
  }
}

/** DELETE — remove a student from the family. */
export async function DELETE(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("parent");
  if (auth.error) return auth.error;

  try {
    const body = removeSchema.parse(await request.json());
    const removed = await removeFamilyMember(auth.user.id, body.studentUserId);
    return NextResponse.json({
      removed,
      message: removed ? "已移出家庭组。" : "该学生不在你的家庭组中。",
    });
  } catch (error) {
    return handleRouteError(error, "移出家庭组失败。");
  }
}
