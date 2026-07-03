import { describe, expect, it } from "vitest";

import { stripMarkdown } from "@/lib/utils";

describe("stripMarkdown", () => {
  it("removes ATX heading markers but keeps the heading text", () => {
    expect(stripMarkdown("### 当前判断")).toBe("当前判断");
    expect(stripMarkdown("# 标题\n正文")).toBe("标题\n正文");
  });

  it("unwraps bold markers", () => {
    expect(stripMarkdown("**① 逐步建仓**")).toBe("① 逐步建仓");
    expect(stripMarkdown("风险 **38** 偏稳健")).toBe("风险 38 偏稳健");
    expect(stripMarkdown("__重点__提示")).toBe("重点提示");
  });

  it("removes thematic breaks and code spans", () => {
    expect(stripMarkdown("一段\n---\n二段")).toBe("一段\n\n二段");
    expect(stripMarkdown("用 `BZA` 代码")).toBe("用 BZA 代码");
  });

  it("leaves plain prose and money strings untouched", () => {
    const plain = "你目前持有 100% 现金，建议分批建仓 -¥1,800。";
    expect(stripMarkdown(plain)).toBe(plain);
  });

  it("collapses the blank-line runs left behind by removed markers", () => {
    expect(stripMarkdown("### A\n\n\n\nB")).toBe("A\n\nB");
  });
});
