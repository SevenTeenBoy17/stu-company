import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const composeFile = "docker-compose.local.yml";
const containerName = "brownzone-pg";

function run(command: string, args: string[], options: { input?: string; shell?: boolean } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    input: options.input,
    shell: options.shell,
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const rendered = [command, ...args].join(" ");
    throw new Error(`Command failed (${result.status ?? "unknown"}): ${rendered}`);
  }
}

function runNpmScript(script: string) {
  if (process.platform === "win32") {
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm", "run", script]);
    return;
  }

  run("npm", ["run", script]);
}

function inspectHealth() {
  const result = spawnSync("docker", ["inspect", "-f", "{{.State.Health.Status}}", containerName], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

function inspectComposeProject() {
  const result = spawnSync("docker", ["inspect", "-f", "{{ index .Config.Labels \"com.docker.compose.project\" }}", containerName], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

function moveLegacyContainerOutOfTheWay() {
  const composeProject = inspectComposeProject();

  if (composeProject === null || (composeProject && composeProject !== "<no value>")) {
    return;
  }

  const legacyName = `${containerName}-legacy-${Date.now()}`;
  console.warn(`Existing non-Compose ${containerName} found. Renaming it to ${legacyName} before Compose startup.`);
  run("docker", ["rename", containerName, legacyName]);
}

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForHealthy(timeoutMs = 60_000) {
  const startedAt = Date.now();
  let lastStatus = "";

  while (Date.now() - startedAt < timeoutMs) {
    lastStatus = inspectHealth();

    if (lastStatus === "healthy") {
      console.log("Postgres container is healthy.");
      return;
    }

    const label = lastStatus || "starting";
    console.log(`Waiting for ${containerName} healthcheck: ${label}`);
    sleep(2_000);
  }

  throw new Error(`${containerName} did not become healthy within ${timeoutMs / 1000}s. Last status: ${lastStatus || "unknown"}`);
}

function applySupabaseShims() {
  const shimPath = resolve(process.cwd(), "scripts", "ci-supabase-shims.sql");
  const sql = readFileSync(shimPath, "utf8");

  run("docker", [
    "exec",
    "-i",
    containerName,
    "psql",
    "-U",
    "postgres",
    "-d",
    "brownzone",
    "-v",
    "ON_ERROR_STOP=1",
  ], { input: sql });
}

console.log("Starting local Postgres with Docker Compose...");
moveLegacyContainerOutOfTheWay();
run("docker", ["compose", "-f", composeFile, "up", "-d"]);
waitForHealthy();

console.log("Applying Supabase-compatible shims...");
applySupabaseShims();

console.log("Running Drizzle migrations...");
runNpmScript("db:migrate");

console.log("Applying RLS policies...");
runNpmScript("db:apply-policies");

console.log("Seeding local data...");
runNpmScript("db:seed");

console.log("\u2705 \u672c\u5730\u5e93\u5c31\u7eea -> http://localhost:3000");
