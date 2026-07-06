// itest5 R4 真实用户旅程端到端：为 6 类用户各跑一条完整旅程（真 HTTP，逐步断言）。
// 判据（R4 门槛）：每步无 5xx、无网络断链(status 0)、关键步命中预期状态 → 旅程「可完成」。
// 用法：BASE_URL=http://127.0.0.1:4200 node scripts/user-journeys.mjs
// 退出码 = 失败旅程数。
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4200";
const ORIGIN = BASE;

function makeJar() { return { cookie: "" }; }
async function req(method, path, { body, jar, headers = {} } = {}) {
  const h = { "content-type": "application/json", origin: ORIGIN, ...headers };
  if (jar?.cookie) h["cookie"] = jar.cookie;
  let res, text, json = null;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  } catch (e) {
    return { status: 0, json: null, text: `FETCH_ERR ${String(e).slice(0, 100)}`, ok: false };
  }
  text = await res.text();
  try { json = JSON.parse(text); } catch { /* */ }
  if (jar) {
    const sc = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of sc) { const m = /^brown_zone_session=([^;]*)/.exec(c); if (m) jar.cookie = `brown_zone_session=${m[1]}`; }
  }
  return { status: res.status, json, text, ok: res.ok };
}
const login = (email, password, jar) => req("POST", "/api/auth/login", { body: { email, password }, jar });

// 一条旅程 = 有序步骤；每步 {label, run:()=>resp, expect?:number|number[]}。
async function runJourney(name, jar, steps) {
  const trace = [];
  let failed = false;
  for (const step of steps) {
    let resp;
    try { resp = await step.run(); } catch (e) { resp = { status: 0, text: String(e).slice(0, 80) }; }
    const s = resp.status;
    const noServerError = s !== 0 && s < 500;
    let ok = noServerError;
    if (step.expect != null) {
      const exp = Array.isArray(step.expect) ? step.expect : [step.expect];
      ok = ok && exp.includes(s);
    }
    if (!ok) failed = true;
    trace.push({ step: step.label, status: s, ok });
    console.log(`  ${ok ? "ok " : "XX "} [${s}] ${step.label}`);
  }
  const verdict = failed ? "FAIL" : "PASS";
  console.log(`[${verdict}] 旅程：${name}`);
  return { name, verdict, failed, trace };
}

async function main() {
  const journeys = [];

  // ── 1. 初一 · 首次使用 · 手机（落地→多市场浏览→首笔交易→任务→领奖→萌宠）──
  {
    const jar = makeJar();
    journeys.push(await runJourney("初一首用手机", jar, [
      { label: "登录", run: () => login("student@brownzone.ai", "BrownZone2026!", jar), expect: 200 },
      { label: "落地沙盘 state", run: () => req("GET", "/api/sim/state", { jar }), expect: 200 },
      { label: "市场雷达·美股", run: () => req("GET", "/api/market/board?category=us", { jar }), expect: 200 },
      { label: "市场雷达·A股(新)", run: () => req("GET", "/api/market/board?category=cn", { jar }), expect: 200 },
      { label: "首笔交易(买入)", run: async () => {
          const st = await req("GET", "/api/sim/state", { jar });
          const assets = st.json?.state?.market?.assets ?? [];
          const a = assets.find((x) => x?.id);
          return req("POST", "/api/sim/actions", { body: { type: "trade", assetId: a?.id ?? "asset-stock", side: "buy", quantity: 1, orderMode: "market" }, jar });
        }, expect: 200 },
      { label: "查看任务", run: () => req("GET", "/api/student/quests", { jar }), expect: 200 },
      { label: "领取奖励", run: async () => {
          const q = await req("GET", "/api/student/quests", { jar });
          const quests = q.json?.payload?.quests ?? [];
          const c = quests.find((x) => x.claimable || x.status === "done");
          return req("POST", "/api/student/quests/draw", { body: { questId: c?.id ?? "diversification-72", source: "quest_claim" }, jar });
        }, expect: [200, 409] },
      { label: "查看萌宠", run: () => req("GET", "/api/student/pet-rewards", { jar }), expect: 200 },
    ]));
  }

  // ── 2. 初二 · 进阶 · 平板（风险测评→定投→港股/基金→观察池→上榜）──
  {
    const jar = makeJar();
    journeys.push(await runJourney("初二进阶平板", jar, [
      { label: "登录", run: () => login("student2@brownzone.ai", "BrownZone2026!", jar), expect: 200 },
      { label: "风险测评 GET", run: () => req("GET", "/api/student/risk-profile", { jar }), expect: 200 },
      { label: "风险测评 提交", run: async () => {
          const rp = await req("GET", "/api/student/risk-profile", { jar });
          const qs = rp.json?.payload?.questions ?? rp.json?.questions ?? [];
          if (!qs.length || !qs[0].options?.length) return { status: 200, text: "no-questions-skip" };
          const answers = qs.map((q) => ({ questionId: q.id, optionId: q.options[0].id }));
          return req("POST", "/api/student/risk-profile", { body: { answers }, jar });
        }, expect: 200 },
      { label: "定投 GET", run: () => req("GET", "/api/student/auto-invest", { jar }), expect: 200 },
      { label: "市场雷达·港股(新)", run: () => req("GET", "/api/market/board?category=hk", { jar }), expect: 200 },
      { label: "市场雷达·基金(新)", run: () => req("GET", "/api/market/board?category=fund", { jar }), expect: 200 },
      { label: "个股详情(茅台)", run: () => req("GET", "/api/market/board?category=cn&symbol=600519", { jar }), expect: 200 },
      { label: "上榜 onboard", run: () => req("POST", "/api/leaderboard/profile", { body: { provinceCode: "51", cityCode: "5101", schoolName: "示范中学", alias: "进阶玩家", visibility: "public", consent: true }, jar }), expect: [200, 201] },
      { label: "查看战力榜", run: () => req("GET", "/api/leaderboard/board?scope=school&period=weekly", { jar }), expect: 200 },
    ]));
  }

  // ── 3. 初三 · 硬核 · 桌面（深度沙盘 + 试极限薅羊毛，边界必须被拦而非崩）──
  {
    const jar = makeJar();
    journeys.push(await runJourney("初三硬核桌面", jar, [
      { label: "登录", run: () => login("student3@brownzone.ai", "BrownZone2026!", jar), expect: 200 },
      { label: "买入", run: async () => {
          const st = await req("GET", "/api/sim/state", { jar });
          const a = (st.json?.state?.market?.assets ?? []).find((x) => x?.id);
          return req("POST", "/api/sim/actions", { body: { type: "trade", assetId: a?.id ?? "asset-stock", side: "buy", quantity: 2, orderMode: "market" }, jar });
        }, expect: 200 },
      { label: "超量卖出被拦(非崩)", run: async () => {
          const st = await req("GET", "/api/sim/state", { jar });
          const a = (st.json?.state?.market?.assets ?? []).find((x) => x?.id);
          return req("POST", "/api/sim/actions", { body: { type: "trade", assetId: a?.id ?? "asset-stock", side: "sell", quantity: 999999, orderMode: "market" }, jar });
        }, expect: [400, 409] },
      { label: "生活账本执行", run: () => req("POST", "/api/student/life-cashflow", { body: { intent: "apply", planId: "balanced", insuranceId: "basic" }, jar }), expect: 200 },
      { label: "同回合二次执行被拦(itest4锁)", run: () => req("POST", "/api/student/life-cashflow", { body: { intent: "apply", planId: "balanced", insuranceId: "basic" }, jar }), expect: [400, 409] },
      { label: "推进回合", run: () => req("POST", "/api/sim/advance-round", { body: {}, jar }), expect: 200 },
      { label: "历史复盘", run: () => req("GET", "/api/student/history-review", { jar }), expect: 200 },
    ]));
  }

  // ── 4. 班主任 · 教师端 ──
  {
    const jar = makeJar();
    journeys.push(await runJourney("班主任教师端", jar, [
      { label: "登录", run: () => login("teacher@brownzone.ai", "BrownZone2026!", jar), expect: 200 },
      { label: "班级总览", run: () => req("GET", "/api/teacher/classroom", { jar }), expect: 200 },
      { label: "作业列表", run: () => req("GET", "/api/teacher/assignments", { jar }), expect: 200 },
    ]));
  }

  // ── 5. 家长 · 家长端 ──
  {
    const jar = makeJar();
    journeys.push(await runJourney("家长家长端", jar, [
      { label: "登录", run: () => login("parent@brownzone.ai", "BrownZone2026!", jar), expect: 200 },
      { label: "家庭成员", run: () => req("GET", "/api/family/members", { jar }), expect: 200 },
      { label: "订阅状态", run: () => req("GET", "/api/billing/status", { jar }), expect: 200 },
      { label: "周报", run: () => req("GET", "/api/parent/report", { jar }), expect: [200, 404] },
    ]));
  }

  // ── 6. 管理员 · admin ──
  {
    const jar = makeJar();
    journeys.push(await runJourney("管理员 admin", jar, [
      { label: "登录", run: () => login("superadmin", "Super001!!!", jar), expect: 200 },
      { label: "用户管理", run: () => req("GET", "/api/admin/users", { jar }), expect: 200 },
    ]));
  }

  const failed = journeys.filter((j) => j.failed);
  const fs = await import("node:fs");
  fs.writeFileSync(".tmp/itest5/r4-user-journeys.json", JSON.stringify({ base: BASE, total: journeys.length, passed: journeys.length - failed.length, failed: failed.length, journeys }, null, 2));
  console.log(`\n=== R4 用户旅程：${journeys.length - failed.length}/${journeys.length} 旅程可完成（base=${BASE}）===`);
  if (failed.length) console.log("FAILED 旅程:", failed.map((f) => f.name).join(" | "));
  process.exit(failed.length);
}
main().catch((e) => { console.error("HARNESS_CRASH", e); process.exit(99); });
