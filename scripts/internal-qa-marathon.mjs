import { spawn } from "node:child_process";
import { mkdir, writeFile, appendFile, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const args = new Map(
  process.argv.slice(2).flatMap((item, index, arr) => {
    if (!item.startsWith("--")) return [];
    const next = arr[index + 1];
    return [[item.slice(2), next && !next.startsWith("--") ? next : "true"]];
  }),
);

const durationHours = Number(args.get("duration-hours") ?? 10);
const intervalMinutes = Number(args.get("interval-minutes") ?? 30);
const once = args.has("once");
const baseUrl = args.get("base-url") ?? process.env.INTERNAL_QA_BASE_URL ?? "http://127.0.0.1:3000";
const runDir = path.join(root, ".tmp", "internal-qa-marathon", stamp);
const eventsPath = path.join(runDir, "events.jsonl");
const summaryPath = path.join(runDir, "summary.md");
const screenshotsDir = path.join(runDir, "screenshots");

const student = {
  email: process.env.INTERNAL_QA_STUDENT_EMAIL ?? "student@brownzone.ai",
  password: process.env.INTERNAL_QA_STUDENT_PASSWORD ?? "BrownZone2026!",
};

const routes = [
  { label: "site-home", path: "/", auth: false },
  { label: "demo", path: "/demo", auth: false },
  { label: "pricing", path: "/pricing", auth: false },
  { label: "student-home", path: "/student", auth: true },
  { label: "student-quests", path: "/student/quests", auth: true },
  { label: "student-market", path: "/student/market", auth: true },
  { label: "student-rank", path: "/student/rank", auth: true },
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1100 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logEvent(event) {
  const payload = {
    at: new Date().toISOString(),
    ...event,
  };
  await appendFile(eventsPath, `${JSON.stringify(payload)}\n`, "utf8");
  return payload;
}

function runCommand(name, command, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        name,
        command,
        ok: code === 0 && !timedOut,
        code,
        timedOut,
        durationMs: Date.now() - started,
        stdoutTail: stdout.slice(-4000),
        stderrTail: stderr.slice(-4000),
      });
    });
  });
}

async function browserAudit(iteration) {
  const result = {
    name: "browser-audit",
    ok: true,
    routeResults: [],
    errors: [],
  };

  let playwright;
  try {
    playwright = await import("playwright");
  } catch (error) {
    result.ok = false;
    result.errors.push(`playwright_import_failed: ${error.message}`);
    return result;
  }

  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, channel: "chrome" });
  } catch (error) {
    result.ok = false;
    result.errors.push(`chrome_launch_failed: ${error.message}`);
    return result;
  }

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      let loginStatus = null;
      try {
        const login = await page.request.post(`${baseUrl}/api/auth/login`, {
          data: student,
          timeout: 15000,
        });
        loginStatus = login.status();
      } catch (error) {
        loginStatus = `failed:${error.message}`;
      }

      for (const route of routes) {
        const url = `${baseUrl}${route.path}`;
        const routeResult = {
          viewport: viewport.name,
          route: route.path,
          label: route.label,
          loginStatus: route.auth ? loginStatus : "not-required",
        };
        try {
          const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(250);
          Object.assign(
            routeResult,
            await page.evaluate(() => {
              const text = document.body.innerText;
              const shells = Array.from(document.querySelectorAll(".poker-flip-shell"));
              const hiddenFaceProblems = shells.filter((shell) => {
                const back = shell.querySelector(".poker-flip-face:not(.poker-flip-front-face)");
                const front = shell.querySelector(".poker-flip-front-face");
                if (!back || !front) return true;
                const backStyle = getComputedStyle(back);
                const frontStyle = getComputedStyle(front);
                const state = shell.getAttribute("data-flip-state");
                return state === "back"
                  ? !(back.getAttribute("aria-hidden") === "false" && front.getAttribute("aria-hidden") === "true" && backStyle.opacity === "1" && frontStyle.opacity === "0")
                  : false;
              });
              const suspiciousText = [
                "This page couldn't load",
                "A server error occurred",
                "undefined",
                "NaN",
                "锛",
                "鐧",
                "娉",
                "�",
              ].filter((needle) => text.includes(needle));
              return {
                title: document.title,
                overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
                hasEnglishError: text.includes("This page couldn't load") || text.includes("A server error occurred"),
                suspiciousText,
                flipShellCount: shells.length,
                hiddenFaceProblems: hiddenFaceProblems.length,
              };
            }),
          );
          routeResult.status = response?.status() ?? null;
          routeResult.consoleErrors = consoleErrors.splice(0);
          routeResult.ok =
            (routeResult.status ?? 500) < 500 &&
            !routeResult.overflow &&
            !routeResult.hasEnglishError &&
            routeResult.suspiciousText.length === 0 &&
            routeResult.hiddenFaceProblems === 0 &&
            routeResult.consoleErrors.length === 0;
          if (!routeResult.ok) result.ok = false;
          if (!routeResult.ok || route.label === "student-quests") {
            const shotPath = path.join(screenshotsDir, `${String(iteration).padStart(2, "0")}-${viewport.name}-${route.label}.png`);
            await page.screenshot({ path: shotPath, fullPage: true });
            routeResult.screenshot = path.relative(root, shotPath);
          }
        } catch (error) {
          routeResult.ok = false;
          routeResult.error = error.message;
          result.ok = false;
        }
        result.routeResults.push(routeResult);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  return result;
}

async function writeSummary(iterations) {
  const lines = [];
  lines.push(`# Brown Zone 10 小时内部内测马拉松`);
  lines.push("");
  lines.push(`- Started: ${startedAt.toISOString()}`);
  lines.push(`- Duration target: ${durationHours}h`);
  lines.push(`- Interval: ${intervalMinutes}min`);
  lines.push(`- Base URL: ${baseUrl}`);
  lines.push(`- Evidence dir: ${runDir}`);
  lines.push("");
  lines.push(`## Iterations`);
  for (const item of iterations) {
    lines.push("");
    lines.push(`### Iteration ${item.iteration} - ${item.startedAt}`);
    lines.push(`- Overall: ${item.ok ? "PASS" : "FAIL"}`);
    for (const step of item.steps) {
      lines.push(`- ${step.name}: ${step.ok ? "PASS" : "FAIL"} (${step.durationMs ?? "-"}ms)`);
    }
    const browser = item.steps.find((step) => step.name === "browser-audit");
    if (browser?.routeResults) {
      const failedRoutes = browser.routeResults.filter((route) => !route.ok);
      lines.push(`- Browser routes: ${browser.routeResults.length - failedRoutes.length}/${browser.routeResults.length} pass`);
      for (const route of failedRoutes.slice(0, 8)) {
        lines.push(`  - FAIL ${route.viewport} ${route.route}: ${route.error ?? route.suspiciousText?.join(", ") ?? route.status}`);
      }
    }
  }
  await writeFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  await mkdir(runDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });
  const iterations = [];
  const endAt = Date.now() + durationHours * 60 * 60 * 1000;
  await logEvent({
    type: "marathon_start",
    durationHours,
    intervalMinutes,
    baseUrl,
    runDir,
  });

  let iteration = 1;
  do {
    const item = {
      iteration,
      startedAt: new Date().toISOString(),
      ok: true,
      steps: [],
    };
    await logEvent({ type: "iteration_start", iteration });

    const commands = [
      ["lint", "npm run lint -- --quiet", 120000],
      ["typecheck", "npx tsc --noEmit", 180000],
      ["quest-component-tests", "npx vitest run src/components/student/student-quest-dashboard.test.tsx", 180000],
      ["core-unit-tests", "npx vitest run src/lib/quests.test.ts src/lib/api-response.test.ts src/components/shared/global-ai-assistant.test.tsx", 240000],
      ["build", "npm run build", 240000],
    ];

    for (const [name, command, timeoutMs] of commands) {
      const result = await runCommand(name, command, timeoutMs);
      item.steps.push(result);
      await logEvent({ type: "step", iteration, ...result });
      if (!result.ok) item.ok = false;
    }

    const browserResult = await browserAudit(iteration);
    item.steps.push(browserResult);
    await logEvent({ type: "step", iteration, ...browserResult });
    if (!browserResult.ok) item.ok = false;

    iterations.push(item);
    await writeSummary(iterations);
    await logEvent({ type: "iteration_end", iteration, ok: item.ok });

    if (once) break;
    iteration += 1;
    const remaining = endAt - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(intervalMinutes * 60 * 1000, remaining));
  } while (Date.now() < endAt);

  await writeSummary(iterations);
  await logEvent({ type: "marathon_end", iterations: iterations.length, ok: iterations.every((item) => item.ok) });

  const summary = await readFile(summaryPath, "utf8");
  console.log(summary);
}

main().catch(async (error) => {
  await mkdir(runDir, { recursive: true });
  await logEvent({ type: "fatal", ok: false, error: error.stack ?? error.message });
  console.error(error);
  process.exit(1);
});
