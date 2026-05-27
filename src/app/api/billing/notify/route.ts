import { NextResponse } from "next/server";

import { verifyWechatSignature } from "@/lib/billing/wechat-pay";

export async function POST(request: Request) {
  const timestamp = request.headers.get("Wechatpay-Timestamp") ?? "";
  const nonce = request.headers.get("Wechatpay-Nonce") ?? "";
  const signature = request.headers.get("Wechatpay-Signature") ?? "";
  const body = await request.text();

  if (!verifyWechatSignature(timestamp, nonce, body, signature)) {
    return NextResponse.json(
      { code: "FAIL", message: "签名验证失败" },
      { status: 401 },
    );
  }

  // TODO(monetization_wechat_engineer): decrypt resource.ciphertext with
  // AES-256-GCM using WECHAT_API_KEY_V3, parse DecryptedNotify, then:
  // 1. Find order by out_trade_no
  // 2. Verify amount matches expected
  // 3. Update users.subscription_tier to the purchased tier
  // 4. Set trial_expires_at to null (no longer on trial)
  // 5. Log the transaction to billing audit table
  //
  // For now, acknowledge receipt so WeChat stops retrying.

  return NextResponse.json({ code: "SUCCESS", message: "成功" });
}
