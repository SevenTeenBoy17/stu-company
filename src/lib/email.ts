import { env } from "@/lib/env";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  delivered: boolean;
  reason?: "not_configured" | "error";
  id?: string;
}

/** True when Resend transactional email is configured (API key + from address). */
export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/**
 * Send a transactional email via Resend. Degrades gracefully: when not
 * configured it reports `not_configured` (callers then surface a dev link) and
 * never throws, so auth flows keep working without an email provider.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) return { delivered: false, reason: "not_configured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!response.ok) return { delivered: false, reason: "error" };
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { delivered: true, id: data.id };
  } catch {
    return { delivered: false, reason: "error" };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell(greeting: string, body: string, ctaLabel: string, ctaUrl: string): string {
  const safeUrl = escapeHtml(ctaUrl);
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
    <p style="font-size:13px;font-weight:700;letter-spacing:.2em;color:#d97706;margin:0 0 16px">MR.BROWN 经济沙盘</p>
    <p style="font-size:16px;font-weight:600;margin:0 0 8px">${greeting}</p>
    <p style="font-size:14px;line-height:1.7;color:#57534e;margin:0 0 20px">${body}</p>
    <a href="${safeUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">${ctaLabel}</a>
    <p style="font-size:12px;line-height:1.6;color:#a8a29e;margin:20px 0 0">如果按钮无法点击，请复制此链接到浏览器：<br>${safeUrl}</p>
  </div></body></html>`;
}

export function verificationEmail(name: string, verifyUrl: string): { subject: string; html: string } {
  return {
    subject: "验证你的 Mr.Brown 经济沙盘账号邮箱",
    html: emailShell(
      `你好 ${escapeHtml(name)}，`,
      "欢迎加入 Mr.Brown 经济沙盘！点击下方按钮验证你的邮箱，激活账号。",
      "验证邮箱",
      verifyUrl,
    ),
  };
}

export function weeklyReportEmail(input: {
  ownerName: string;
  studentName: string;
  netWorth: number;
  round: number;
  persona: string;
}): { subject: string; html: string } {
  const safeStudent = escapeHtml(input.studentName);
  return {
    subject: `${input.studentName} 的本周财商成长周报 · Mr.Brown`,
    html: `<!doctype html><html><body style="margin:0;background:#faf7f2;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
    <p style="font-size:13px;font-weight:700;letter-spacing:.2em;color:#d97706;margin:0 0 16px">MR.BROWN 经济沙盘 · 家长周报</p>
    <p style="font-size:16px;font-weight:600;margin:0 0 8px">你好 ${escapeHtml(input.ownerName)}，</p>
    <p style="font-size:14px;line-height:1.7;color:#57534e;margin:0 0 16px">这是 ${safeStudent} 本周在经济沙盘里的成长概况：</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#78716c">当前回合</td><td style="padding:8px 0;text-align:right;font-weight:700">第 ${input.round} 回合</td></tr>
      <tr><td style="padding:8px 0;color:#78716c">模拟净值</td><td style="padding:8px 0;text-align:right;font-weight:700">￥${input.netWorth.toLocaleString()}</td></tr>
      <tr><td style="padding:8px 0;color:#78716c">投资人格</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#d97706">${escapeHtml(input.persona)}</td></tr>
    </table>
    <p style="font-size:12px;line-height:1.6;color:#a8a29e;margin:18px 0 0">这是教育模拟，不构成任何投资建议。登录平台可查看完整 AI 复盘与行为雷达。</p>
  </div></body></html>`,
  };
}

export function passwordResetEmail(name: string, resetUrl: string): { subject: string; html: string } {
  return {
    subject: "重置你的 Mr.Brown 经济沙盘密码",
    html: emailShell(
      `你好 ${escapeHtml(name)}，`,
      "我们收到了你的密码重置请求。点击下方按钮设置新密码，链接 1 小时内有效；若非本人操作请忽略本邮件。",
      "重置密码",
      resetUrl,
    ),
  };
}
