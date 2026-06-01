import { createDecipheriv, createSign, createVerify, randomBytes } from "node:crypto";

import type { PaymentChannel } from "@/lib/types";

export interface WechatPayConfig {
  mchId: string;
  apiKeyV3: string;
  appId: string;
  notifyUrl: string;
  privateKey: string;
  certSerialNo: string;
  platformPublicKey?: string;
}

export interface PrepayRequest {
  outTradeNo: string;
  description: string;
  amountFen: number;
  channel: Extract<PaymentChannel, "native" | "jsapi">;
  payerOpenId?: string;
}

export interface PrepayResult {
  channel: Extract<PaymentChannel, "native" | "jsapi">;
  codeUrl?: string;
  prepayId?: string;
  jsapiParams?: {
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
    associated_data?: string;
  };
}

export interface DecryptedNotify {
  out_trade_no: string;
  transaction_id: string;
  trade_state: "SUCCESS" | "CLOSED" | "PAYERROR" | "NOTPAY" | "REFUND";
  amount: { total: number; payer_total?: number; currency: string };
  payer?: { openid: string };
  success_time?: string;
}

const WECHAT_API_ORIGIN = "https://api.mch.weixin.qq.com";

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function normalizePem(value: string) {
  return value.replace(/\\n/g, "\n");
}

function getConfig(): WechatPayConfig | null {
  const mchId = envValue("WECHAT_MCH_ID", "WECHAT_PAY_MCH_ID");
  const apiKeyV3 = envValue("WECHAT_API_KEY_V3", "WECHAT_PAY_API_V3_KEY");
  const appId = envValue("WECHAT_APP_ID", "WECHAT_PAY_APPID");
  const notifyUrl = envValue("WECHAT_NOTIFY_URL", "WECHAT_PAY_NOTIFY_URL");
  const privateKey = envValue("WECHAT_PRIVATE_KEY", "WECHAT_PAY_PRIVATE_KEY");
  const certSerialNo = envValue("WECHAT_CERT_SERIAL_NO", "WECHAT_PAY_CERT_SERIAL_NO");
  const platformPublicKey = envValue(
    "WECHAT_PLATFORM_PUBLIC_KEY",
    "WECHAT_PAY_PLATFORM_PUBLIC_KEY",
  );

  if (!mchId || !apiKeyV3 || !appId || !notifyUrl || !privateKey || !certSerialNo) {
    return null;
  }

  return {
    mchId,
    apiKeyV3,
    appId,
    notifyUrl,
    privateKey: normalizePem(privateKey),
    certSerialNo,
    platformPublicKey: platformPublicKey ? normalizePem(platformPublicKey) : undefined,
  };
}

export function generateNonce() {
  return randomBytes(16).toString("hex");
}

export function isWechatPayConfigured() {
  return getConfig() !== null;
}

export function isWechatMockAllowed() {
  return process.env.WECHAT_PAY_MOCK_MODE === "true" || process.env.NODE_ENV !== "production";
}

function signRsaSha256(message: string, privateKey: string) {
  return createSign("RSA-SHA256").update(message).sign(privateKey, "base64");
}

function buildAuthorizationHeader(
  config: WechatPayConfig,
  method: string,
  urlPath: string,
  body: string,
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signRsaSha256(message, config.privateKey);

  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.certSerialNo}",signature="${signature}"`;
}

async function postWechat<T>(path: string, body: unknown): Promise<T> {
  const config = getConfig();
  if (!config) throw new Error("微信支付未配置，请联系管理员。");

  const rawBody = JSON.stringify(body);
  const response = await fetch(`${WECHAT_API_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      Authorization: buildAuthorizationHeader(config, "POST", path, rawBody),
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: rawBody,
  });

  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? `微信支付下单失败（${response.status}）。`);
  }
  return payload;
}

export async function createPrepayOrder(request: PrepayRequest): Promise<PrepayResult> {
  const config = getConfig();
  if (!config) throw new Error("微信支付未配置，请联系管理员。");

  const baseBody = {
    mchid: config.mchId,
    appid: config.appId,
    description: request.description,
    out_trade_no: request.outTradeNo,
    notify_url: config.notifyUrl,
    amount: { total: request.amountFen, currency: "CNY" },
  };

  if (request.channel === "native") {
    const payload = await postWechat<{ code_url: string }>(
      "/v3/pay/transactions/native",
      baseBody,
    );
    return { channel: "native", codeUrl: payload.code_url };
  }

  if (!request.payerOpenId) {
    throw new Error("微信内支付需要 openId。");
  }

  const payload = await postWechat<{ prepay_id: string }>(
    "/v3/pay/transactions/jsapi",
    {
      ...baseBody,
      payer: { openid: request.payerOpenId },
    },
  );

  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = generateNonce();
  const packageValue = `prepay_id=${payload.prepay_id}`;
  const signMessage = `${config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const paySign = signRsaSha256(signMessage, config.privateKey);

  return {
    channel: "jsapi",
    prepayId: payload.prepay_id,
    jsapiParams: {
      appId: config.appId,
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: "RSA",
      paySign,
    },
  };
}

export function verifyWechatSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
) {
  const config = getConfig();
  if (!config) return false;

  if (!config.platformPublicKey) {
    return (
      process.env.WECHAT_PAY_SKIP_NOTIFY_SIGNATURE === "true" &&
      process.env.NODE_ENV !== "production"
    );
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${timestamp}\n${nonce}\n${body}\n`);
  return verifier.verify(config.platformPublicKey, signature, "base64");
}

export function decryptWechatResource(resource: NotifyPayload["resource"]): DecryptedNotify {
  const config = getConfig();
  if (!config) throw new Error("微信支付未配置，请联系管理员。");
  if (resource.algorithm !== "AEAD_AES_256_GCM") {
    throw new Error("不支持的微信支付回调加密算法。");
  }

  const encrypted = Buffer.from(resource.ciphertext, "base64");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(config.apiKeyV3, "utf8"),
    Buffer.from(resource.nonce, "utf8"),
  );
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext) as DecryptedNotify;
}
