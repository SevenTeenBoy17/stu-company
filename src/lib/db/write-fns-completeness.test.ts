// @vitest-environment node
//
// itest7 P3：WRITE_FNS 是手维白名单——凡对 DB 做写入(insert/update/delete)的 repo 函数都必须登记，
// 否则 ALLOW_MEMORY_FALLBACK 开启的离线 demo 下写失败会被判为「非写函数」而静默落内存兜底，
// 学生交易/进度假成功后丢失（历史上漏登记发生过 6 次）。此前无结构测试，新增漏登记时 CI 立即失败。

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoSource = fs.readFileSync(
  path.join(process.cwd(), "src", "lib", "db", "repo.ts"),
  "utf8",
);

function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
}

/** 提取 `const WRITE_FNS = new Set([ "a", "b", ... ])` 里的登记名。 */
function extractWriteFns(src: string): Set<string> {
  const m = src.match(/const WRITE_FNS = new Set(?:<string>)?\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error("找不到 WRITE_FNS 定义");
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}

/**
 * 找出所有【会写库】的导出 async 函数：其函数体（到下一个 `export ` 之前）出现 drizzle 写调用
 * (.insert( / .update( / .delete()。onConflictDoUpdate 属 insert 的一部分，仍是写，计入。
 */
function extractWritingFns(src: string): string[] {
  const clean = stripComments(src);
  const chunks = clean.split(/export async function /).slice(1);
  const writers: string[] = [];
  for (const chunk of chunks) {
    const name = chunk.match(/^([A-Za-z0-9_]+)\s*[(<]/)?.[1];
    if (!name) continue;
    // 只取到下一个顶层 export 之前的片段，避免把后一个函数的写调用算到本函数头上。
    const body = chunk.split(/\nexport /)[0];
    if (/\.(insert|update|delete)\(/.test(body)) writers.push(name);
  }
  return writers;
}

describe("WRITE_FNS 完整性结构审计 (itest7 P3)", () => {
  it("每个对 DB 写入的 repo 导出函数都已登记进 WRITE_FNS", () => {
    const registered = extractWriteFns(repoSource);
    const writers = extractWritingFns(repoSource);
    const missing = writers.filter((name) => !registered.has(name)).sort();
    expect(missing, `以下写库函数漏登记 WRITE_FNS（会导致离线 demo 静默丢数据）: ${missing.join(", ")}`).toEqual([]);
  });

  it("WRITE_FNS 非空且成员均为字符串（护栏本身健康）", () => {
    const registered = extractWriteFns(repoSource);
    expect(registered.size).toBeGreaterThan(10);
  });
});
