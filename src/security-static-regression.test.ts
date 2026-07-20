// @vitest-environment node

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const sourceRoots = ["src", "scripts"].map((dir) => path.join(repoRoot, dir));
const appSourceRoot = path.join(repoRoot, "src");
const scannedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(fullPath);
      return entry.isFile() && scannedExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
    });
}

function rel(file: string) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function filesMatching(files: string[], pattern: RegExp) {
  return files
    .map((file) => ({ file, source: fs.readFileSync(file, "utf8") }))
    .filter(({ source }) => pattern.test(source))
    .map(({ file }) => rel(file))
    .sort();
}

describe("static security guardrails", () => {
  it("does not commit provider-like secrets into source or scripts", () => {
    const providerSecretPattern =
      /(^|[^A-Za-z0-9_])(sk-[A-Za-z0-9_-]{20,}|sk_[A-Za-z0-9_-]{20,}|pk_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{30,})/;
    expect(filesMatching(sourceRoots.flatMap(sourceFiles), providerSecretPattern)).toEqual([]);
  });

  it("keeps application AI provider hosts out of app source", () => {
    const directAiHostPattern =
      /api\.anthropic\.com|api\.openai\.com|gpt-agent\.cc|api\.llm-token\.cn|\/v1\/chat\/completions|\/v1\/images\/generations/;
    expect(filesMatching(sourceFiles(appSourceRoot), directAiHostPattern)).toEqual([]);
  });

  it("does not use dynamic code execution or direct HTML injection in app source", () => {
    const dangerousRuntimePattern = new RegExp(
      ["eval\\(", "new Function\\(", "dangerouslySet" + "InnerHTML", "\\.innerHTML\\s*="].join("|"),
    );
    expect(filesMatching(sourceFiles(appSourceRoot), dangerousRuntimePattern)).toEqual([]);
  });
});
