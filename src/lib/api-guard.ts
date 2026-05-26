import { apiError } from "@/lib/api-response";
import { readSession } from "@/lib/auth";
import { findUserById } from "@/lib/db/repo";
import type { Role } from "@/lib/types";

export async function requireUser(requiredRole?: Role) {
  const session = await readSession();
  if (!session) {
    return { error: apiError("unauthorized", "请先登录后再访问这个接口。", 401) };
  }

  const user = await findUserById(session.userId);
  if (!user) {
    return { error: apiError("unauthorized", "会话用户不存在，请重新登录。", 401) };
  }

  // H2: server-side JWT invalidation. tokenVersion bumps on logout / password
  // change, leaving outstanding cookies dead even if they haven't expired.
  if ((user.tokenVersion ?? 0) !== (session.tv ?? 0)) {
    return { error: apiError("unauthorized", "会话已失效，请重新登录。", 401) };
  }

  if (requiredRole && user.role !== requiredRole) {
    return { error: apiError("forbidden", "当前账号没有该接口权限。", 403) };
  }

  return { user };
}
