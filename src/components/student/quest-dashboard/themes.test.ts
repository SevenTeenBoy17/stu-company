import { describe, expect, it } from "vitest";

import { buildStudentQuestPayload } from "@/lib/quests";
import { createInitialRun } from "@/lib/simulation";

import { questBoxThemeFor, questBoxThemes, questThemeIdByQuestId } from "./themes";

const learning = { completed: 0, total: 8, completedKeys: [] as string[] };

describe("quest ↔ companion theme mapping", () => {
  it("双射回归锁：真实 12 任务全部显式登记，且 12 个伙伴主题恰好各被使用一次", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const payload = buildStudentQuestPayload(run, learning);

    // 每个真实任务 id 都有显式配对（新增任务未登记时此处红，提示补表而非依赖序号）。
    for (const quest of payload.quests) {
      expect(questThemeIdByQuestId[quest.id], `任务 ${quest.id} 缺少伙伴配对登记`).toBeTruthy();
    }

    // 配对值与 questBoxThemes 一一双射：12 个主题 id 全覆盖、无重复、无幽灵 id。
    const mappedThemeIds = Object.values(questThemeIdByQuestId);
    const themeIds = questBoxThemes.map((theme) => theme.id);
    expect(new Set(mappedThemeIds).size).toBe(mappedThemeIds.length);
    expect([...mappedThemeIds].sort()).toEqual([...themeIds].sort());
  });

  it("显式配对优先于调用方序号：同一任务在任何序号下都映射同一伙伴（去序号耦合）", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const payload = buildStudentQuestPayload(run, learning);
    const diversification = payload.quests.find((quest) => quest.id === "diversification-72");
    expect(diversification).toBeTruthy();

    expect(questBoxThemeFor(diversification!, 0).id).toBe("fox-sunrise");
    expect(questBoxThemeFor(diversification!, 5).id).toBe("fox-sunrise");
    expect(questBoxThemeFor(diversification!, 11).id).toBe("fox-sunrise");
  });

  it("未登记 id（测试夹具/过渡态）回退序号映射，保证图鉴仍可点亮", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const payload = buildStudentQuestPayload(run, learning);
    const pseudo = { ...payload.quests[0], id: "fixture-only-quest" };

    expect(questBoxThemeFor(pseudo, 3).id).toBe(questBoxThemes[3].id);
  });
});
