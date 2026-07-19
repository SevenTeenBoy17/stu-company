/**
 * Central super-admin authority check.
 *
 * Super-admins hold every write privilege in the admin console — resetting
 * passwords/emails, and configuring / confirming manual WeChat collection.
 * This predicate used to be copy-pasted in 6 places (5 API routes + the admin
 * page), which is a drift/security risk. Centralizing it here gives one place
 * to manage who is authorized.
 *
 * Authorized identities:
 *  - the built-in `superadmin` account (id or email === "superadmin");
 *  - the named competition-team members in {@link SUPERADMIN_TEAM} — the
 *    company's contest students, who are also product users and super-admins;
 *  - any comma-separated emails in the `SUPERADMIN_EMAILS` env var, so ops can
 *    grant/revoke access without a code change.
 */

/**
 * 参赛团队成员：本公司参加竞赛的学生，既是产品用户，也是超级管理员。
 * store.ts 的种子账号与本清单同源，避免账号与授权名单漂移。
 */
export const SUPERADMIN_TEAM = [
  { id: "admin-baiyangjinmei", email: "baiyangjinmei@brownzone.ai", name: "白杨晋美" },
  { id: "admin-luobulang", email: "luobulang@brownzone.ai", name: "罗布朗" },
  { id: "admin-liuyuke", email: "liuyuke@brownzone.ai", name: "刘煜柯" },
  { id: "admin-zhangjunxiang", email: "zhangjunxiang@brownzone.ai", name: "张珺湘" },
] as const;

const STATIC_SUPERADMIN_EMAILS = new Set<string>([
  "superadmin",
  ...SUPERADMIN_TEAM.map((member) => member.email.toLowerCase()),
]);

function envSuperadminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the user holds super-admin write authority. Email match is case-insensitive. */
export function isSuperAdmin(user: { id: string; email: string }): boolean {
  if (user.id === "superadmin") return true;
  const email = user.email.toLowerCase();
  return STATIC_SUPERADMIN_EMAILS.has(email) || envSuperadminEmails().includes(email);
}
