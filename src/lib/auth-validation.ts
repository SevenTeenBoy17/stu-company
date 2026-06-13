import { z } from "zod";

// Shared rule constants so the schema (server enforcement) and the live
// `passwordRequirements` checklist (client guidance) can never drift apart —
// both are built from exactly these values.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HAS_LETTER = /[a-zA-Z]/;
const PASSWORD_HAS_DIGIT = /\d/;
export const INVITE_CODE_PATTERN = /^[a-zA-Z0-9-]{6,40}$/;
export const INVITE_CODE_FORMAT_MESSAGE = "邀请码只能包含字母、数字和短横线。";

/**
 * Single source of truth for the "注册体验账号" registration rules and their
 * Simplified-Chinese messages. Shared by the server boundary
 * (`/api/auth/register`) and the client pre-submit guard (`demo-portal.tsx`) so
 * the rules — and the human-readable error a user sees — live in exactly one
 * place. Every message is end-user-facing Chinese per the house style.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(2, "昵称至少需要 2 个字符。").max(16, "昵称最多 16 个字符。"),
  email: z.string().trim().email("请输入有效的邮箱地址。").max(255, "邮箱地址过长。"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `密码至少 ${PASSWORD_MIN_LENGTH} 位。`)
    .regex(PASSWORD_HAS_LETTER, "密码需要包含至少一个字母。")
    .regex(PASSWORD_HAS_DIGIT, "密码需要包含至少一个数字。"),
  inviteCode: z
    .string()
    .min(6, "邀请码至少 6 位。")
    .max(40, "邀请码最多 40 位。")
    .regex(INVITE_CODE_PATTERN, INVITE_CODE_FORMAT_MESSAGE)
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterField = keyof RegisterInput;

/**
 * Live password requirements, surfaced next to the field so a user knows the
 * rules *while* typing instead of discovering them only on a failed submit.
 * Each `test` mirrors exactly one rule in `registerSchema.password` and reuses
 * the same constants, so the checklist can never disagree with what the server
 * enforces. (The regexes are flag-less, so `.test()` is stateless and reusable.)
 */
export const passwordRequirements: { label: string; test: (password: string) => boolean }[] = [
  { label: `至少 ${PASSWORD_MIN_LENGTH} 位`, test: (password) => password.length >= PASSWORD_MIN_LENGTH },
  { label: "包含字母", test: (password) => PASSWORD_HAS_LETTER.test(password) },
  { label: "包含数字", test: (password) => PASSWORD_HAS_DIGIT.test(password) },
];

/**
 * Returns the first human-readable (Simplified Chinese) validation error for a
 * candidate registration payload, or `null` when the input is valid. Surfacing
 * the schema's specific message — instead of a generic "format incorrect" — is
 * what lets a student see *why* registration failed (e.g. the password is
 * missing a digit) rather than blindly retrying into the rate limiter.
 */
export function firstRegisterError(input: unknown): string | null {
  const result = registerSchema.safeParse(input);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "请求参数格式不正确，请检查后重试。";
}

/**
 * Maps a candidate payload to a `{ field: message }` object holding the first
 * Simplified-Chinese error per field, or an empty object when valid. Lets the
 * form render each error next to the field it belongs to ("适宜位置处") rather
 * than in a single detached banner.
 */
export function registerFieldErrors(input: unknown): Partial<Record<RegisterField, string>> {
  const result = registerSchema.safeParse(input);
  if (result.success) return {};
  const errors: Partial<Record<RegisterField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && errors[field as RegisterField] === undefined) {
      errors[field as RegisterField] = issue.message;
    }
  }
  return errors;
}
