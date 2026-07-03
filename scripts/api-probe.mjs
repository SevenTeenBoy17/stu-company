// R2 后端 API 真流程探针：对运行中的服务器发真实 HTTP，逐项断言状态码/响应形状/门控/限流/CSRF/错误形状。
// 用法：BASE_URL=http://127.0.0.1:4200 node scripts/api-probe.mjs
// 不做视觉测试；每项都等真实响应返回并留证据。退出码 = 失败项数。
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4200";
const ORIGIN = BASE;

const results = [];
function record(name, pass, detail, evidence) {
  results.push({ name, pass, detail, evidence });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name} — ${detail}`);
}

/** tiny cookie jar: capture brown_zone_session from Set-Cookie, replay on next reqs */
function makeJar() {
  return { cookie: "" };
}
async function req(method, path, { body, jar, origin = ORIGIN, noOrigin = false, headers = {} } = {}) {
  const h = { "content-type": "application/json", ...headers };
  if (!noOrigin) h["origin"] = origin;
  if (jar?.cookie) h["cookie"] = jar.cookie;
  let res, text, json = null;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  } catch (e) {
    return { status: 0, json: null, text: `FETCH_ERR ${String(e).slice(0, 120)}`, ok: false };
  }
  text = await res.text();
  try { json = JSON.parse(text); } catch { /* non-json */ }
  if (jar) {
    const sc = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of sc) {
      const m = /^brown_zone_session=([^;]*)/.exec(c);
      if (m) jar.cookie = `brown_zone_session=${m[1]}`;
    }
  }
  return { status: res.status, json, text, ok: res.ok, headers: res.headers };
}
async function login(email, password, jar) {
  return req("POST", "/api/auth/login", { body: { email, password }, jar });
}
const ev = (r) => ({ status: r.status, body: (r.text || "").slice(0, 160) });

async function main() {
  // ── A. CSRF (checkOrigin on /api/sim/* + billing) ──
  // 契约：仅 production + APP_URL 设定时，跨域 Origin→403；无 Origin 按设计放行（非浏览器/同源）。
  {
    const jar = makeJar();
    await login("student@brownzone.ai", "BrownZone2026!", jar);
    const badOri = await req("POST", "/api/sim/actions", { body: { type: "bank", action: "deposit", amount: 100 }, jar, origin: "https://evil.example.com" });
    record("CSRF: sim/actions 跨域 Origin 被拒(403)", badOri.status === 403, `期望403 实得${badOri.status}（需 prod+APP_URL）`, ev(badOri));
    const noOri = await req("POST", "/api/sim/actions", { body: { type: "bank", action: "deposit", amount: 100 }, jar, noOrigin: true });
    record("CSRF: 无 Origin 按设计放行(非403)", noOri.status !== 403, `期望非403 实得${noOri.status}（设计放行=非浏览器同源）`, ev(noOri));
  }

  // ── B. Auth ──
  {
    const jar = makeJar();
    const ok = await login("student@brownzone.ai", "BrownZone2026!", jar);
    record("Auth: 学生登录成功", ok.status === 200 && ok.json?.redirectTo === "/student", `实得${ok.status} redirect=${ok.json?.redirectTo}`, ev(ok));
    const bad = await login("student@brownzone.ai", "wrong-password", makeJar());
    record("Auth: 错误密码 401 + 错误形状", bad.status === 401 && bad.json?.error === "unauthorized" && typeof bad.json?.message === "string", `实得${bad.status} error=${bad.json?.error}`, ev(bad));
    const malformed = await req("POST", "/api/auth/login", { body: { email: "not-an-email", password: "x" } });
    record("Auth: 畸形输入被拒(401)", malformed.status === 401, `实得${malformed.status}`, ev(malformed));
  }

  // ── C. Auth guard (unauth + role) ──
  {
    const anon = await req("GET", "/api/sim/state", {});
    record("Guard: 未登录访问 sim/state 被拒", anon.status === 401 || anon.status === 403, `期望401/403 实得${anon.status}`, ev(anon));
    const studentJar = makeJar();
    await login("student@brownzone.ai", "BrownZone2026!", studentJar);
    const adminByStudent = await req("GET", "/api/admin/users", { jar: studentJar });
    record("Guard: 学生访问 admin/users 被拒(403)", adminByStudent.status === 403, `期望403 实得${adminByStudent.status}`, ev(adminByStudent));
    const adminPostByStudent = await req("POST", "/api/admin/users", { body: {}, jar: studentJar });
    record("Guard: 学生 POST admin/users 被拒", adminPostByStudent.status === 403 || adminPostByStudent.status === 401, `实得${adminPostByStudent.status}`, ev(adminPostByStudent));
  }

  // ── D. Sim engine (student real flow) ──
  const simJar = makeJar();
  await login("student2@brownzone.ai", "BrownZone2026!", simJar);
  {
    const st = await req("GET", "/api/sim/state", { jar: simJar });
    const state = st.json?.state ?? st.json;
    const assets = state?.market?.assets ?? state?.market ?? [];
    const asset = Array.isArray(assets) ? assets.find((a) => a?.id) : null;
    record("Sim: GET state 有 run+market", st.status === 200 && !!state?.run && Array.isArray(assets) && assets.length > 0, `实得${st.status} assets=${assets.length}`, ev(st));

    if (asset) {
      const buy = await req("POST", "/api/sim/actions", { body: { type: "trade", assetId: asset.id, side: "buy", quantity: 1, orderMode: "market" }, jar: simJar });
      record("Sim: trade buy 成功", buy.status === 200, `实得${buy.status} asset=${asset.id}`, ev(buy));
    } else {
      record("Sim: trade buy 成功", false, "未发现可用 asset id", ev(st));
    }

    const dep = await req("POST", "/api/sim/actions", { body: { type: "bank", action: "deposit", amount: 500 }, jar: simJar });
    record("Sim: bank deposit 成功", dep.status === 200, `实得${dep.status}`, ev(dep));

    const badAmt = await req("POST", "/api/sim/actions", { body: { type: "bank", action: "deposit", amount: -50 }, jar: simJar });
    record("Sim: 负数金额被拒(400)", badAmt.status === 400 && badAmt.json?.error === "invalid_input", `期望400 invalid_input 实得${badAmt.status}/${badAmt.json?.error}`, ev(badAmt));

    const adv = await req("POST", "/api/sim/advance-round", { body: {}, jar: simJar });
    record("Sim: advance-round 成功", adv.status === 200, `实得${adv.status}`, ev(adv));
  }

  // ── E. Quests + de-loot-box ──
  {
    const q = await req("GET", "/api/student/quests", { jar: simJar });
    const quests = q.json?.payload?.quests ?? q.json?.quests ?? [];
    record("Quests: GET 返回 12 任务", q.status === 200 && quests.length === 12, `实得${q.status} count=${quests.length}`, ev(q));
    const claimable = quests.find((x) => x.claimable || x.status === "done");
    if (claimable) {
      const draw1 = await req("POST", "/api/student/quests/draw", { body: { questId: claimable.id, source: "quest_claim" }, jar: simJar });
      record("Quests: 领取(draw)成功", draw1.status === 200, `实得${draw1.status} quest=${claimable.id}`, ev(draw1));
      const draw2 = await req("POST", "/api/student/quests/draw", { body: { questId: claimable.id, source: "quest_claim" }, jar: simJar });
      record("Quests: 重复领取幂等(200/409)", draw2.status === 200 || draw2.status === 409, `实得${draw2.status}`, ev(draw2));
    } else {
      record("Quests: 领取(draw)成功", false, "无可领取任务", ev(q));
    }
  }

  // ── F. Pet rewards (新功能所依赖的 payload) ──
  {
    const pr = await req("GET", "/api/student/pet-rewards", { jar: simJar });
    const p = pr.json?.payload ?? pr.json;
    record("Pet: GET pet-rewards 有 timeline+rewards+nextActions", pr.status === 200 && Array.isArray(p?.timeline) && Array.isArray(p?.rewards) && Array.isArray(p?.nextActions), `实得${pr.status} tl=${p?.timeline?.length} rw=${p?.rewards?.length} na=${p?.nextActions?.length}`, ev(pr));
  }

  // ── G. 理财 write happy-path (active student) ──
  {
    const rp = await req("GET", "/api/student/risk-profile", { jar: simJar });
    record("理财: GET risk-profile 200", rp.status === 200, `实得${rp.status}`, ev(rp));
    const questions = rp.json?.payload?.questions ?? rp.json?.questions ?? [];
    if (questions.length > 0 && questions[0].options?.length) {
      const answers = questions.map((qq) => ({ questionId: qq.id, optionId: qq.options[0].id }));
      const post = await req("POST", "/api/student/risk-profile", { body: { answers }, jar: simJar });
      record("理财: POST risk-profile(有效)200", post.status === 200, `实得${post.status}`, ev(post));
    } else {
      record("理财: POST risk-profile(有效)200", false, "GET 未暴露题目结构，跳过写入", ev(rp));
    }
  }

  // ── H. Leaderboard onboard + board ──
  {
    const regions = await req("GET", "/api/leaderboard/regions", { jar: simJar });
    const provinces = regions.json?.provinces ?? regions.json?.payload?.provinces ?? [];
    record("Rank: GET regions 200", regions.status === 200, `实得${regions.status} provinces=${provinces.length}`, ev(regions));
    const board = await req("GET", "/api/leaderboard/board?scope=school&period=weekly", { jar: simJar });
    record("Rank: GET board 200", board.status === 200, `实得${board.status}`, ev(board));
    const me = await req("GET", "/api/leaderboard/me", { jar: simJar });
    record("Rank: GET me 200/onboarding态", me.status === 200 || me.status === 404, `实得${me.status}`, ev(me));
  }

  // ── I. Market reads ──
  {
    for (const [name, path] of [["board", "/api/market/board"], ["season", "/api/market/season-leaderboard"], ["ticker", "/api/market/ticker-tape"]]) {
      const r = await req("GET", path, { jar: simJar });
      record(`Market: GET ${name} 200`, r.status === 200, `实得${r.status}`, ev(r));
    }
  }

  // ── J. Admin gating (superadmin OK) ──
  {
    const adminJar = makeJar();
    const alogin = await login("superadmin", "Super001!!!", adminJar);
    record("Admin: superadmin 登录成功", alogin.status === 200, `实得${alogin.status}`, ev(alogin));
    const users = await req("GET", "/api/admin/users", { jar: adminJar });
    record("Admin: superadmin GET users 200", users.status === 200, `实得${users.status}`, ev(users));
  }

  // ── K. Rate limit (real production limits — server must run WITHOUT multiplier) ──
  {
    let hit429 = false, last = 0;
    for (let i = 0; i < 16; i++) {
      const r = await login("ratelimit-probe@nowhere.test", "wrong-pass", makeJar());
      last = r.status;
      if (r.status === 429) { hit429 = true; break; }
    }
    record("RateLimit: 连续失败登录触发 429", hit429, hit429 ? "命中429" : `16 次内未命中(末次${last})——可能服务器带 E2E_RATE_LIMIT_MULTIPLIER`, { last, hit429 });
  }

  // ── R3-FIX verifications (itest4 修复复验) ──
  {
    // pet-rewards：去 rarity 线级词，改 tier 层级
    const pr = await req("GET", "/api/student/pet-rewards", { jar: simJar });
    const body = pr.text || "";
    const noRarityVocab = !/"rarity"|"epic"|"rare"|"common"/.test(body);
    const hasTier = /"tier"\s*:\s*"(basic|advanced|honor)"/.test(body);
    record("R3修复: pet-rewards 去 rarity 线级、改 tier", noRarityVocab && hasTier, `noRarityVocab=${noRarityVocab} hasTier=${hasTier}`, { snippet: body.slice(0, 120) });

    // 生活账本同回合二次执行被拒（幂等）
    const apply1 = await req("POST", "/api/student/life-cashflow", { body: { intent: "apply", planId: "balanced", insuranceId: "basic" }, jar: simJar });
    const apply2 = await req("POST", "/api/student/life-cashflow", { body: { intent: "apply", planId: "balanced", insuranceId: "basic" }, jar: simJar });
    const secondRejected = apply2.status >= 400 && /本回合已执行/.test(apply2.text || "");
    record("R3修复: 生活账本同回合二次执行被拒", apply1.status === 200 && secondRejected, `first=${apply1.status} second=${apply2.status}`, ev(apply2));

    // 榜单不再透传 userId
    const rankJar = makeJar();
    await login("student@brownzone.ai", "BrownZone2026!", rankJar);
    const board = await req("GET", "/api/leaderboard/board?scope=nation&period=weekly", { jar: rankJar });
    const leaksUserId = /"userId"/.test(board.text || "");
    record("R3修复: 榜单不透传玩家 userId", board.status === 200 && !leaksUserId, `status=${board.status} leaksUserId=${leaksUserId}`, { snippet: (board.text || "").slice(0, 140) });
  }

  // ── L. Error shape consistency（抽样断言） ──
  {
    const anon = await req("GET", "/api/sim/state", {});
    const shapeOk = anon.json && typeof anon.json.error === "string" && typeof anon.json.message === "string";
    record("ErrorShape: {error,message} 一致", !!shapeOk, `error=${anon.json?.error} msg有=${typeof anon.json?.message === "string"}`, ev(anon));
  }

  // ── summary ──
  const fails = results.filter((r) => !r.pass);
  const summary = { base: BASE, total: results.length, passed: results.length - fails.length, failed: fails.length, results };
  const fs = await import("node:fs");
  fs.writeFileSync(".tmp/itest4/r2-api-probe.json", JSON.stringify(summary, null, 2));
  console.log(`\n=== R2 API PROBE: ${summary.passed}/${summary.total} passed, ${summary.failed} failed (base=${BASE}) ===`);
  if (fails.length) console.log("FAILED:", fails.map((f) => f.name).join(" | "));
  process.exit(fails.length);
}
main().catch((e) => { console.error("HARNESS_CRASH", e); process.exit(99); });
