import { createHmac, randomBytes } from "node:crypto";

export interface WechatPayConfig {
  mchId: string;
  apiKeyV3: string;
  appId: string;
  notifyUrl: string;
}

export interface PrepayRequest {
  outTradeNo: string;
  description: string;
  amountFen: number;
  payerOpenId: string;
}

export interface PrepayResult {
  prepayId: string;
  jsapiParams: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: "RSA";
    paySign: string;
  };
}

export interface NotifyPayload {
  id: string;
  event_type: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    nonce: string;
    associated_data: string;
  };
}

export interface DecryptedNotify {
  out_trade_no: string;
  transaction_id: string;
  trade_state: "SUCCESS" | "CLOSED" | "PAYERROR" | "NOTPAY";
  amount: { total: number; payer_total: number; currency: string };
  payer: { openid: string };
  success_time: string;
}

function getConfig(): WechatPayConfig | null {
  const mchId = process.env.WECHAT_MCH_ID;
  const apiKeyV3 = process.env.WECHAT_API_KEY_V3;
  const appId = process.env.WECHAT_APP_ID;
  const notifyUrl = process.env.WECHAT_NOTIFY_URL;

  if (!mchId || !apiKeyV3 || !appId || !notifyUrl) return null;
  return { mchId, apiKeyV3, appId, notifyUrl };
}

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export function isWechatPayConfigured(): boolean {
  return getConfig() !== null;
}

// SCAFFOLD: This function outlines the prepay flow but uses placeholder signing.
// Before production use, monetization_wechat_engineer must:
// 1. Replace HMAC with RSA-SHA256 using the merchant private key PEM
// 2. Implement proper WECHATPAY2-SHA256-RSA2048 Authorization header
// 3. Create an orders table to track outTradeNo -> userId mapping
export async function createPrepayOrder(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  request: PrepayRequest,
): Promise<PrepayResult> {
  const config = getConfig();
  if (!config) throw new Error("微信支付未配置，请联系管理员。");

  throw new Error(
    "微信支付接口尚未完成 RSA 签名集成，暂时无法创建订单。请联系技术团队。",
  );
}

export function verifyWechatSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
): boolean {
  const config = getConfig();
  if (!config) return false;

  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const expected = createHmac("sha256", config.apiKeyV3).update(message).digest("base64");
  return expected === signature;
}
