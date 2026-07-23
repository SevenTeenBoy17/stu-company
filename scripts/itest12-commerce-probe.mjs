// itest12-P1 · 商业闭环真交互探针（Commerce closed-loop real-interaction probe）
// 一切以真实 HTTP 返回为准。对运行中的真 DB 生产服务器（默认 :8923）逐项打印 [PASS]/[FAIL]。
// 用法：BASE_URL=http://127.0.0.1:8923 node scripts/itest12-commerce-probe.mjs
//
// 手工 cookie 回放法（照抄 scripts/api-probe.mjs 第 14-43 行）：生产 Secure cookie 在
// http://127.0.0.1 下 Node(undici) 请求栈不会自动回发，必须手工解析 Set-Cookie 并以
// cookie 头回放——本仓已验证的唯一可靠方式。
//
// 退出码 = 失败项数。
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8923";
const ORIGIN = BASE;
const CRON_SECRET = process.env.CRON_SECRET ?? "student-ui-v3-cron-secret-0722-restartABCD";

const results = [];
function record(name, pass, detail, evidence) {
  results.push({ name, pass, detail, evidence });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name} — ${detail}`);
}
function note(msg) {
  console.log(`   · ${msg}`);
}

/** tiny cookie jar: capture brown_zone_session from Set-Cookie, replay on next reqs */
function makeJar() {
  return { cookie: "" };
}

async function req(method, path, { body, jar, origin = ORIGIN, noOrigin = false, headers = {}, timeoutMs = 20000 } = {}) {
  const h = { "content-type": "application/json", ...headers };
  if (!noOrigin) h["origin"] = origin;
  if (jar?.cookie) h["cookie"] = jar.cookie;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res, text, json = null;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, json: null, text: `FETCH_ERR ${String(e).slice(0, 160)}`, ok: false, headers: new Headers() };
  }
  clearTimeout(timer);
  text = await res.text();
  try { json = JSON.parse(text); } catch { /* non-json */ }
  if (jar) {
    // Manual Set-Cookie parse + replay (undici won't auto-send a Secure cookie over http://127.0.0.1)
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

const ev = (r) => ({ status: r.status, body: (r.text || "").slice(0, 200) });

async function main() {
  console.log(`\n=== itest12 商业闭环真交互探针 base=${BASE} ===\n`);
  const stamp = Date.now();
  const newEmail = `it12-${stamp}@test.local`;
  const newPassword = "It12Probe!2026";
  const newName = `内测生${String(stamp).slice(-5)}`;
  const studentJar = makeJar();
  let newStudentId = null;
  let parentCode = null;

  // ───────────────────────── A. 全新注册旅程 ─────────────────────────
  console.log("── A. 全新注册旅程（邀请码注册→登录→有 run→真交易→铸家长码）──");
  {
    // A1: register-by-invite {inviteCode,name,email,password}
    const reg = await req("POST", "/api/auth/register-by-invite", {
      body: { inviteCode: "MRB-STUDENT-2026", name: newName, email: newEmail, password: newPassword },
      jar: studentJar,
    });
    record(
      "A1 邀请码注册 register-by-invite 200 + redirectTo /student",
      reg.status === 200 && reg.json?.redirectTo === "/student",
      `实得${reg.status} redirect=${reg.json?.redirectTo} msg=${reg.json?.message ?? reg.json?.error}`,
      ev(reg),
    );
    if (reg.status !== 200) {
      note(`注册失败，后续 A/B/C 依赖此账号将连锁失败。原文：${(reg.text || "").slice(0, 160)}`);
    }

    // A2: 用新号显式再登录一次（拿到干净 cookie；注册本身也已下发 cookie）
    const lg = await login(newEmail, newPassword, studentJar);
    record(
      "A2 新号登录成功 200 + redirectTo /student",
      lg.status === 200 && lg.json?.redirectTo === "/student",
      `实得${lg.status} redirect=${lg.json?.redirectTo}`,
      ev(lg),
    );

    // A3: GET sim/state 有 run + market.assets
    const st = await req("GET", "/api/sim/state", { jar: studentJar });
    const state = st.json?.state ?? st.json;
    const assets = state?.market?.assets ?? [];
    newStudentId = state?.run?.userId ?? null;
    const firstAsset = Array.isArray(assets) ? assets.find((a) => a?.id) : null;
    record(
      "A3 GET sim/state 200 + 有 run + market.assets",
      st.status === 200 && !!state?.run && Array.isArray(assets) && assets.length > 0,
      `实得${st.status} run=${!!state?.run} assets=${assets.length} round=${state?.run?.currentRound}`,
      ev(st),
    );

    // A4: 全新试点学生「首笔真交易」——按 api-probe 形状 {type:trade,assetId,side,quantity,orderMode}
    if (firstAsset) {
      const buy = await req("POST", "/api/sim/actions", {
        body: { type: "trade", assetId: firstAsset.id, side: "buy", quantity: 1, orderMode: "market" },
        jar: studentJar,
      });
      const pass = buy.status === 200;
      record(
        "A4 新生首笔真交易 sim/actions(trade buy) 200",
        pass,
        `实得${buy.status} asset=${firstAsset.id} err=${buy.json?.error ?? ""}`,
        ev(buy),
      );
      if (!pass) {
        note(
          `根因初判：registerUserByInvite 未写 trialExpiresAt（对照 registerUserByEmail repo.ts:1532-1544 会给 3 天试用），` +
          `故新生 tier=free 且无试用→resolveSubscriptionState 走 expiredState→canOperate=false→sim/actions 返回 ${buy.status}「${buy.json?.message ?? ""}」。` +
          `这是邀请注册与邮箱注册的不对称，疑似遗漏。B 步给该生开通 Premium 后将复验交易可用性（见 B7）。`,
        );
      }
    } else {
      record("A4 新生首笔真交易 sim/actions(trade buy) 200", false, "state 未暴露可交易 asset", ev(st));
    }

    // A5: 学生铸家长绑定码 → 断言形如 MRB-P-*
    const pInv = await req("POST", "/api/student/parent-invite", { jar: studentJar });
    parentCode = pInv.json?.code ?? null;
    record(
      "A5 学生铸家长码 parent-invite → MRB-P-*",
      pInv.status === 200 && typeof parentCode === "string" && /^MRB-P-[A-Z0-9]+$/.test(parentCode),
      `实得${pInv.status} code=${parentCode} reused=${pInv.json?.reused}`,
      ev(pInv),
    );
  }

  // ───────────────────────── B. 人工收款商业闭环 ─────────────────────────
  console.log("\n── B. 人工收款商业闭环（超管配置→建单→交凭证→确认→学生订阅已开通）──");
  const adminJar = makeJar();
  let outTradeNo = null;
  {
    // B1: 超管登录 baiyangjinmei / Super001!!!
    const al = await login("baiyangjinmei@brownzone.ai", "Super001!!!", adminJar);
    record("B1 超管 baiyangjinmei 登录成功 200", al.status === 200, `实得${al.status} redirect=${al.json?.redirectTo}`, ev(al));

    // B2: 超管 PATCH manual-config 配置人工收款 → readiness ready
    const cfg = await req("PATCH", "/api/admin/billing/manual-config", {
      jar: adminJar,
      body: {
        qrUrl: "https://brownzone.ai/demo/manual-collect-qr.png",
        payeeName: "Brown Zone 财商实验室（内测）",
        instruction: "请微信扫码付款，并在付款备注填写订单号；付款后提交凭证，超管核验到账即开通。",
      },
    });
    const readyLabel = cfg.json?.readiness?.label;
    record(
      "B2 超管配置人工收款 manual-config(PATCH) 200 + readiness=ready",
      cfg.status === 200 && readyLabel === "ready" && cfg.json?.readiness?.ready === true,
      `实得${cfg.status} readiness=${readyLabel} qrConfigured=${cfg.json?.config?.qrConfigured}`,
      ev(cfg),
    );

    // B3: 建人工收款订单（学生不能自付—prepay:78-83 对 student 恒 403；由超管作为成年代付方
    //     为该生建 manual 单，targetUserId=新生。这是代码唯一支持的真实商业路径）。
    if (newStudentId) {
      const order = await req("POST", "/api/billing/prepay", {
        jar: adminJar,
        body: { tier: "premium", channel: "manual", targetUserId: newStudentId },
      });
      outTradeNo = order.json?.outTradeNo ?? null;
      record(
        "B3 超管为新生建人工 Premium 单 prepay(manual) 200 + outTradeNo",
        order.status === 200 && typeof outTradeNo === "string" && order.json?.manual === true,
        `实得${order.status} outTradeNo=${outTradeNo} amountFen=${order.json?.amountFen} mode=${order.json?.paymentMode}`,
        ev(order),
      );
    } else {
      record("B3 超管为新生建人工 Premium 单 prepay(manual) 200 + outTradeNo", false, "缺 newStudentId（A 步失败）", {});
    }

    // B3b: 佐证护栏——学生本人直接发起付款必被拒 403（未成年不可自付；这正是为何由超管代付）
    if (studentJar.cookie) {
      const selfPay = await req("POST", "/api/billing/prepay", {
        jar: studentJar,
        body: { tier: "premium", channel: "manual" },
      });
      record(
        "B3b 护栏：学生本人直接付款被拒 403（未成年不可自付）",
        selfPay.status === 403,
        `实得${selfPay.status} err=${selfPay.json?.error} msg=${(selfPay.json?.message ?? "").slice(0, 40)}`,
        ev(selfPay),
      );
      note("任务书 B 步「学生 POST manual-proof 提交凭证」在现有代码下不可达：学生不能建单(此处 403)，" +
        "且 manual-proof 要求 order.userId===提交者。真实闭环的买方=成年代付方(超管/家长/教师)，本探针据此以超管代付走通闭环。");
    }

    // B4: 代付方（超管，=order.userId）提交付款凭证 manual-proof
    if (outTradeNo) {
      const proof = await req("POST", "/api/billing/manual-proof", {
        jar: adminJar,
        body: { outTradeNo, note: `内测代付凭证 ${stamp}：已微信转账，备注含订单号。` },
      });
      record(
        "B4 代付方提交付款凭证 manual-proof 200",
        proof.status === 200 && proof.json?.order?.status === "pending",
        `实得${proof.status} orderStatus=${proof.json?.order?.status}`,
        ev(proof),
      );
    } else {
      record("B4 代付方提交付款凭证 manual-proof 200", false, "缺 outTradeNo（B3 失败）", {});
    }

    // B5: 超管「列单」——读人工收款后台面（config/readiness），再确认到账
    const listing = await req("GET", "/api/admin/billing/manual-config", { jar: adminJar });
    record(
      "B5 超管读人工收款后台面 manual-config(GET) 200 + canManage",
      listing.status === 200 && listing.json?.canManage === true,
      `实得${listing.status} canManage=${listing.json?.canManage} readiness=${listing.json?.readiness?.label}`,
      ev(listing),
    );

    // B6: 超管确认到账 manual-confirm → grant 已开通
    if (outTradeNo) {
      const confirm = await req("POST", "/api/admin/billing/manual-confirm", {
        jar: adminJar,
        body: { outTradeNo, note: "内测：已核验到账。" },
      });
      const grantedTier = confirm.json?.grant?.tier;
      record(
        "B6 超管确认到账 manual-confirm 200 + grant(premium) 非重复履约",
        confirm.status === 200 && confirm.json?.alreadyFulfilled === false && grantedTier === "premium",
        `实得${confirm.status} grantTier=${grantedTier} already=${confirm.json?.alreadyFulfilled} orderStatus=${confirm.json?.order?.status}`,
        ev(confirm),
      );
    } else {
      record("B6 超管确认到账 manual-confirm 200 + grant(premium)", false, "缺 outTradeNo（B3 失败）", {});
    }

    // B7: 复查学生订阅态——以学生本人 cookie GET billing/status → premium + active
    const status = await req("GET", "/api/billing/status", { jar: studentJar });
    const tier = status.json?.tier;
    const sstatus = status.json?.status;
    record(
      "B7 学生订阅态 billing/status → premium + active + canOperate",
      status.status === 200 && tier === "premium" && sstatus === "active" && status.json?.canOperate === true,
      `实得${status.status} tier=${tier} status=${sstatus} canOperate=${status.json?.canOperate} 到期=${status.json?.subscriptionExpiresAt}`,
      ev(status),
    );

    // B7b: 开通后复验交易可用（隔离 A4 根因：证明沙盘引擎对该号交易路径本身正常）
    const st2 = await req("GET", "/api/sim/state", { jar: studentJar });
    const asset2 = (st2.json?.state?.market?.assets ?? []).find((a) => a?.id);
    if (asset2) {
      const buy2 = await req("POST", "/api/sim/actions", {
        body: { type: "trade", assetId: asset2.id, side: "buy", quantity: 1, orderMode: "market" },
        jar: studentJar,
      });
      record(
        "B7b 开通 Premium 后新生真交易 sim/actions 200（隔离 A4 = 仅缺试用）",
        buy2.status === 200,
        `实得${buy2.status} asset=${asset2.id} err=${buy2.json?.error ?? ""}`,
        ev(buy2),
      );
    } else {
      record("B7b 开通 Premium 后新生真交易 sim/actions 200", false, "无可交易 asset", ev(st2));
    }
  }

  // ───────────────────────── C. AI 真调用 ─────────────────────────
  console.log("\n── C. AI 真调用（学生号 /api/ai/chat；60s 超时；须非降级）──");
  {
    const chat = await req("POST", "/api/ai/chat", {
      jar: studentJar,
      timeoutMs: 60000,
      body: {
        prompt: "我是新加入的学生，请用一句话说明这个经济沙盘教我什么？",
        pageContext: { route: "/student" },
      },
    });
    const reply = typeof chat.json?.reply === "string" ? chat.json.reply : "";
    const provider = chat.json?.provider;
    const degradedMark = /(暂时不可用|暂不可用|兜底|服务不可用|稍后再试|AI\s*(?:暂时|服务).{0,6}(?:不可用|离线))/.test(reply);
    const pass = chat.status === 200 && reply.trim().length > 0 && provider === "remote" && !degradedMark;
    record(
      "C AI 真调用 /api/ai/chat 200 + provider=remote + 回复非空非降级",
      pass,
      `实得${chat.status} provider=${provider} replyLen=${reply.length} mode=${chat.json?.mode}`,
      { status: chat.status, provider, replyHead: reply.slice(0, 90) },
    );
    if (!pass) {
      if (provider === "fallback") {
        note(`降级：provider=fallback，AI 网关未触达真实供应商。回复头 60 字：「${reply.slice(0, 60)}」 baseUrl=${chat.json?.baseUrl}`);
      } else if (chat.status !== 200) {
        note(`非 200：${chat.status}，原文：${(chat.text || "").slice(0, 120)}`);
      } else {
        note(`回复头 60 字：「${reply.slice(0, 60)}」 provider=${provider}`);
      }
    } else {
      note(`AI 回复头 60 字：「${reply.slice(0, 60)}」 baseUrl=${chat.json?.baseUrl}`);
    }
  }

  // ───────────────────────── D. cron 双端点 ─────────────────────────
  console.log("\n── D. cron 双端点（正确 Bearer→200；错 token→401）──");
  {
    const goodHdr = { authorization: `Bearer ${CRON_SECRET}` };
    const weekly = await req("GET", "/api/cron/weekly-report", { headers: goodHdr });
    record(
      "D1 weekly-report 正确 Bearer 200",
      weekly.status === 200,
      `实得${weekly.status} processed=${weekly.json?.processed} sent=${weekly.json?.sent}`,
      ev(weekly),
    );
    const recompute = await req("GET", "/api/cron/recompute-leaderboard", { headers: goodHdr });
    record(
      "D2 recompute-leaderboard 正确 Bearer 200",
      recompute.status === 200,
      `实得${recompute.status} body=${(recompute.text || "").slice(0, 80)}`,
      ev(recompute),
    );
    const badWeekly = await req("GET", "/api/cron/weekly-report", { headers: { authorization: "Bearer wrong-token-xyz" } });
    record("D3 weekly-report 错 token 401", badWeekly.status === 401, `实得${badWeekly.status} err=${badWeekly.json?.error}`, ev(badWeekly));
    const badRecompute = await req("GET", "/api/cron/recompute-leaderboard", { headers: { authorization: "Bearer wrong-token-xyz" } });
    record("D4 recompute-leaderboard 错 token 401", badRecompute.status === 401, `实得${badRecompute.status} err=${badRecompute.json?.error}`, ev(badRecompute));
  }

  // ───────────────────────── E. 安全抽查 ─────────────────────────
  console.log("\n── E. 安全抽查（跨域 CSRF→403；连续错密码→429，末位执行避免污染）──");
  {
    // E1: 跨域 Origin 发 sim/actions → 403（checkOrigin 在鉴权前，prod+APP_URL 生效）
    const crossJar = makeJar();
    await login("student@brownzone.ai", "BrownZone2026!", crossJar);
    const cross = await req("POST", "/api/sim/actions", {
      jar: crossJar,
      origin: "https://evil.example.com",
      body: { type: "bank", action: "deposit", amount: 100 },
    });
    record(
      "E1 跨域 Origin 发 sim/actions 被拒 403",
      cross.status === 403,
      `实得${cross.status} err=${cross.json?.error} msg=${(cross.json?.message ?? "").slice(0, 30)}`,
      ev(cross),
    );

    // E2: 连续错密码登录 → 429。真实阈值=每账号 12 次（login/route.ts:48）→ 第 13 次才 429；
    //     用独立 bogus 邮箱避免锁死真账号。任务书「6 次」与真实阈值不符，此处按真实阈值验证护栏生效。
    const rlEmail = `it12-rl-${stamp}@test.local`;
    let hit429 = false, firstHitAt = 0, last = 0;
    for (let i = 1; i <= 14; i++) {
      const r = await login(rlEmail, "definitely-wrong-pass", makeJar());
      last = r.status;
      if (r.status === 429 && !hit429) { hit429 = true; firstHitAt = i; break; }
    }
    let by6 = false;
    // 单独确认「6 次内是否已 429」：另用一枚全新邮箱只打 6 次
    const rlEmail6 = `it12-rl6-${stamp}@test.local`;
    for (let i = 1; i <= 6; i++) {
      const r = await login(rlEmail6, "definitely-wrong-pass", makeJar());
      if (r.status === 429) { by6 = true; break; }
    }
    record(
      "E2 连续错密码登录触发 429（限流护栏生效）",
      hit429,
      `命中429@第${firstHitAt}次（末位状态${last}）；6次内命中=${by6}`,
      { firstHitAt, hit429, by6, last },
    );
    note(`真实阈值=每账号 12 次失败（login/route.ts:48 peek@12）→ 第 13 次返回 429；任务书写「6 次」与真实实现不符（6 次不足以触发）。`);
  }

  // ───────────────────────── summary ─────────────────────────
  const fails = results.filter((r) => !r.pass);
  console.log(`\n=== itest12 COMMERCE PROBE: ${results.length - fails.length}/${results.length} PASS, ${fails.length} FAIL (base=${BASE}) ===`);
  if (fails.length) console.log("FAILED 项：", fails.map((f) => f.name).join(" | "));
  process.exit(fails.length);
}

main().catch((e) => { console.error("HARNESS_CRASH", e); process.exit(99); });
