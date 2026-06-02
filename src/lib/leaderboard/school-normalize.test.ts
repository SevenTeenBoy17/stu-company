import { describe, expect, it } from "vitest";

import { normalizeSchoolName, sanitizeDisplayText, schoolDedupKey } from "./school-normalize";

describe("normalizeSchoolName", () => {
  it("trims and removes inner whitespace", () => {
    expect(normalizeSchoolName(" 成都市 第七 中学 ")).toBe("成都市第七中学");
  });

  it("strips common punctuation (full- and half-width)", () => {
    expect(normalizeSchoolName("（成都）七中！")).toBe("成都七中");
    expect(normalizeSchoolName("成都·七中")).toBe("成都七中");
  });

  it("folds full-width latin/digits to half-width and lowercases", () => {
    expect(normalizeSchoolName("ＡＢＣ外国语学校")).toBe("abc外国语学校");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeSchoolName("   ")).toBe("");
  });

  it("does NOT merge synonyms (left to moderation)", () => {
    // intentionally different after normalization — auto-merge would be unsafe
    expect(normalizeSchoolName("七中")).not.toBe(normalizeSchoolName("第七中学"));
  });
});

describe("sanitizeDisplayText (board-safe alias/school)", () => {
  it("strips zero-width and bidi-override characters", () => {
    expect(sanitizeDisplayText("小​财‮迷")).toBe("小财迷");
    expect(sanitizeDisplayText("abc﻿")).toBe("abc");
  });

  it("strips control characters and collapses whitespace", () => {
    expect(sanitizeDisplayText("稳健  小   能手")).toBe("稳健 小 能手");
  });

  it("preserves full-width characters (nickname look kept)", () => {
    expect(sanitizeDisplayText("财商达人ＡＢ")).toBe("财商达人ＡＢ");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeDisplayText("  学霸  ")).toBe("学霸");
  });
});

describe("schoolDedupKey", () => {
  it("collapses spacing/punctuation differences within the same city", () => {
    expect(schoolDedupKey("成都  七中", "5101")).toBe(schoolDedupKey("成都七中", "5101"));
  });

  it("keeps same-name schools in different cities distinct", () => {
    expect(schoolDedupKey("实验中学", "5101")).not.toBe(schoolDedupKey("实验中学", "4401"));
  });
});
