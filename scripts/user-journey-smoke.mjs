// One-off realistic student journey against the LIVE prod server (localhost:8910),
// with Origin set to the tunnel URL so checkOrigin passes (== external user).
// Run: node scripts/user-journey-smoke.mjs  [baseUrl] [originUrl]
const BASE = process.argv[2] || "http://localhost:8910";
const ORIGIN = process.argv[3] || "https://pension-interracial-algorithm-gone.trycloudflare.com";
let cookie = "";
const results = [];

function grab(res) {
  const sc = res.headers.get("set-cookie");
  if (sc) { const m = sc.match(/brown_zone_session=[^;]+/); if (m) cookie = m[0]; }
}
async function call(method, path, body) {
  const headers = { "content-type": "application/json", origin: ORIGIN };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  grab(res);
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
function ok(label, cond, extra = "") {
  results.push(cond ? "P" : "F");
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}  ${extra}`);
}

(async () => {
  const email = `realuser${Math.floor(Math.random() * 1e6)}@example.com`;
  console.log(`# user: ${email}  base: ${BASE}\n`);

  let r = await call("POST", "/api/auth/register", { name: "林同学", email, password: "Test123456!" });
  ok("register student", r.status === 200 && r.json?.redirectTo === "/student", `[${r.status}]`);

  r = await call("GET", "/api/sim/state");
  const cash0 = r.json?.state?.run?.cash;
  const round0 = r.json?.state?.run?.currentRound;
  ok("initial sandbox state", r.status === 200 && typeof round0 === "number", `cash=${cash0} round=${round0}`);

  r = await call("POST", "/api/sim/actions", { type: "trade", assetId: "asset-etf", side: "buy", quantity: 20, orderMode: "market" });
  ok("buy ETF x20 (market)", r.status === 200, `[${r.status}] ${r.json?.error || r.json?.message || ""}`);

  r = await call("POST", "/api/sim/actions", { type: "bank", action: "deposit", amount: 5000 });
  ok("bank deposit 5000", r.status === 200, `[${r.status}] ${r.json?.error || ""}`);

  r = await call("POST", "/api/sim/advance-round");
  ok("advance round", r.status === 200, `round -> ${r.json?.state?.run?.currentRound}`);

  r = await call("GET", "/api/sim/state");
  const round1 = r.json?.state?.run?.currentRound;
  ok("persisted after refresh", r.status === 200 && round1 === round0 + 1, `round=${round1} cash=${r.json?.state?.run?.cash}`);

  for (const sym of ["NVDA", "MU", "TSM"]) {
    r = await call("GET", `/api/market/board?symbol=${sym}`);
    const s = r.json?.selected;
    const chg = typeof s?.changePercent === "number" ? s.changePercent.toFixed(2) : "?";
    ok(`market board ${sym}`, r.status === 200 && !!s, `provider=${r.json?.provider} price=${s?.currentPrice} chg=${chg}% candles=${s?.candles?.length} src=${s?.source}`);
  }

  r = await call("GET", "/api/student/risk-profile");
  const qs = r.json?.payload?.questions;
  ok("risk questionnaire GET", r.status === 200 && Array.isArray(qs), `${qs?.length ?? "?"} questions`);
  if (Array.isArray(qs)) {
    const answers = qs.map((q) => ({ questionId: q.id, optionId: q.options[1]?.id ?? q.options[0].id }));
    r = await call("POST", "/api/student/risk-profile", { answers });
    ok("risk questionnaire submit", r.status === 200 && r.json?.persisted === true, `band=${r.json?.payload?.band ?? r.json?.band ?? "?"}`);
  }

  for (const [label, path] of [
    ["quests GET", "/api/student/quests"],
    ["auto-invest GET", "/api/student/auto-invest"],
    ["wealth-summary GET", "/api/student/wealth-summary"],
    ["life-cashflow GET", "/api/student/life-cashflow"],
    ["credit-lab GET", "/api/student/credit-lab"],
    ["learn progress GET", "/api/learn/progress"],
  ]) {
    r = await call("GET", path);
    ok(label, r.status === 200, `[${r.status}]`);
  }

  const fails = results.filter((x) => x === "F").length;
  console.log(`\n=== ${results.length - fails}/${results.length} PASS, ${fails} FAIL ===`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("journey crashed:", e); process.exit(1); });
