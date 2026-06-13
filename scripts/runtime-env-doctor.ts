import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
loadEnvConfig(process.cwd(), true);

type Check = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

const checks: Check[] = [];

function value(key: string) {
  return process.env[key]?.trim() ?? "";
}

function firstValue(keys: string[]) {
  for (const key of keys) {
    const current = value(key);
    if (current) return { key, value: current };
  }
  return { key: keys[0], value: "" };
}

function add(check: Check) {
  checks.push(check);
}

function safeUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    return {
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || "(default)",
      database: parsed.pathname.replace(/^\//, "") || "(none)",
      sslmode: parsed.searchParams.get("sslmode") ?? "(none)",
    };
  } catch {
    return null;
  }
}

function errorSummary(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  const maybeAggregate = error as { code?: string; errors?: Array<{ code?: string; address?: string; port?: number }> };
  if (maybeAggregate.code) {
    const targets =
      maybeAggregate.errors
        ?.map((item) => [item.code, item.address, item.port].filter(Boolean).join("@"))
        .filter(Boolean)
        .join(", ") ?? "";
    return targets ? `${maybeAggregate.code}: ${targets}` : maybeAggregate.code;
  }
  return "连接失败";
}

const appUrl = value("APP_URL");
add({
  name: "APP_URL",
  status: appUrl.startsWith("http") ? "pass" : "fail",
  detail: appUrl ? "已配置" : "缺少 APP_URL",
});

const sessionSecret = value("SESSION_SECRET");
add({
  name: "SESSION_SECRET",
  status: sessionSecret.length >= 32 ? "pass" : "fail",
  detail: sessionSecret ? `长度 ${sessionSecret.length}` : "缺少 SESSION_SECRET",
});

const databaseUrl = value("DATABASE_URL");
const dbTarget = databaseUrl ? safeUrl(databaseUrl) : null;
const dbIsLocal =
  dbTarget?.host === "localhost" || dbTarget?.host === "127.0.0.1" || dbTarget?.host === "::1";
add({
  name: "DATABASE_URL",
  status: !databaseUrl || !dbTarget ? "fail" : dbIsLocal ? "warn" : "pass",
  detail: !databaseUrl
    ? "缺少 DATABASE_URL，线上登录/订单/订阅都会失败"
    : !dbTarget
      ? "DATABASE_URL 不是合法 URL"
      : `${dbTarget.protocol}//${dbTarget.host}:${dbTarget.port}/${dbTarget.database} sslmode=${dbTarget.sslmode}${
          dbIsLocal ? "；注意：线上不能使用 localhost 数据库" : ""
        }`,
});

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const) {
  const current = value(key);
  add({
    name: key,
    status: current ? "pass" : "fail",
    detail: current ? "已配置" : `缺少 ${key}`,
  });
}

const wechatAliases = {
  mchId: ["WECHAT_MCH_ID", "WECHAT_PAY_MCH_ID", "WECHAT_PAY_MCHID"],
  apiKeyV3: ["WECHAT_API_KEY_V3", "WECHAT_PAY_API_V3_KEY", "WECHAT_PAY_API_KEY_V3"],
  appId: ["WECHAT_APP_ID", "WECHAT_PAY_APP_ID", "WECHAT_PAY_APPID"],
  notifyUrl: ["WECHAT_NOTIFY_URL", "WECHAT_PAY_NOTIFY_URL"],
  privateKey: ["WECHAT_PRIVATE_KEY", "WECHAT_PAY_PRIVATE_KEY"],
  certSerialNo: ["WECHAT_CERT_SERIAL_NO", "WECHAT_PAY_CERT_SERIAL_NO"],
  platformPublicKey: ["WECHAT_PLATFORM_PUBLIC_KEY", "WECHAT_PAY_PLATFORM_PUBLIC_KEY"],
};

const wechatMissing: string[] = [];
const wechatPresent: string[] = [];
for (const [label, keys] of Object.entries(wechatAliases)) {
  const found = firstValue(keys);
  if (found.value) {
    wechatPresent.push(`${label}(${found.key})`);
  } else if (label !== "platformPublicKey") {
    wechatMissing.push(keys.join(" / "));
  }
}

add({
  name: "WeChat Pay",
  status: wechatMissing.length === 0 ? "pass" : value("WECHAT_PAY_MOCK_MODE") === "true" ? "warn" : "fail",
  detail:
    wechatMissing.length === 0
      ? `真实微信支付变量已配置：${wechatPresent.join(", ")}`
      : `缺少真实微信支付变量：${wechatMissing.join("; ")}。未配齐时只能做演示订单，不能自动回调开通订阅。`,
});

const notifyUrl = firstValue(wechatAliases.notifyUrl).value;
add({
  name: "WECHAT_NOTIFY_URL",
  status: !notifyUrl ? "fail" : notifyUrl.startsWith("https://") ? "pass" : "fail",
  detail: notifyUrl ? "必须是公网 HTTPS /api/billing/notify" : "缺少微信支付回调地址",
});

const fallback = value("ALLOW_MEMORY_FALLBACK");
add({
  name: "ALLOW_MEMORY_FALLBACK",
  status: fallback === "true" ? "warn" : "pass",
  detail:
    fallback === "true"
      ? "仅适合离线教师电脑演示；真实线上订阅不要打开内存兜底"
      : "生产安全：不会把写入假装落到内存",
});

async function checkDatabaseConnection() {
  if (!databaseUrl || !dbTarget) return;

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 1,
  });
  try {
    await sql`select 1`;
    add({
      name: "DATABASE_CONNECTION",
      status: "pass",
      detail: "Postgres 连接成功",
    });
  } catch (error) {
    const message = errorSummary(error);
    add({
      name: "DATABASE_CONNECTION",
      status: "fail",
      detail: `Postgres 无法连接：${message.slice(0, 180)}`,
    });
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}

async function main() {
  await checkDatabaseConnection();

  for (const check of checks) {
    const icon = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`[${icon}] ${check.name}: ${check.detail}`);
  }

  const hasFail = checks.some((check) => check.status === "fail");
  process.exit(hasFail ? 1 : 0);
}

void main();
