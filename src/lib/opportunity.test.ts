import { describe, expect, it } from "vitest";

import { buildHistoryReviewPayload } from "@/lib/history-review";
import { buildStudentSeasonChallengePayload } from "@/lib/season-challenges";
import { buildSimulationState, createInitialRun } from "@/lib/simulation";
import { buildOpportunityPayload, createOpportunityNote } from "@/lib/opportunity";
import type { Classroom, UserRecord } from "@/lib/types";

function stateFor(run: ReturnType<typeof createInitialRun>) {
  const user: UserRecord = {
    id: "student-1",
    email: "student@example.com",
    passwordHash: "hash",
    name: "测试学生",
    role: "student",
    title: "观察训练者",
    classroomId: "classroom-1",
  };
  const classroom: Classroom = {
    id: "classroom-1",
    name: "测试班级",
    region: "成都",
    teacherId: "teacher-1",
    challengeTheme: "冷静观察者",
    schoolRank: 1,
  };
  return buildSimulationState(user, classroom, run, [run], [user]);
}

describe("opportunity training", () => {
  it("builds teaching opportunity cards without mutating the run", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const payload = buildOpportunityPayload(run);

    expect(payload.cards.length).toBeGreaterThanOrEqual(4);
    expect(payload.overview.notesCount).toBe(0);
    expect(payload.overview.stageLabel).toBe("等待第一张观察单");
    expect(run.actionLog).toHaveLength(0);
  });

  it("records an observation note as history-only action", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const netWorthBefore = run.netWorth;
    const outcome = createOpportunityNote(run, {
      cardId: "ai-infra",
      reason: "learning",
      confidence: 66,
      note: "AI 算力需求强，但我还需要观察估值和短期波动风险。",
    });

    expect(outcome.run.actionLog[0]).toMatchObject({
      type: "opportunity",
      amount: 0,
      label: "机会观察：AI 算力与基础设施",
      meta: expect.objectContaining({ kind: "opportunity_note", cardId: "ai-infra", reasonLabel: "课堂概念" }),
    });
    expect(outcome.run.netWorth).toBe(netWorthBefore);
    expect(outcome.payload.overview.notesCount).toBe(1);
    expect(outcome.note.feedback).toContain("证据");
  });

  it("feeds observation notes into history review and season challenge progress", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const outcome = createOpportunityNote(run, {
      cardId: "green-energy",
      reason: "policy",
      confidence: 58,
      note: "能源转型有政策线索，但我需要继续观察需求和产能竞争。",
    });

    const history = buildHistoryReviewPayload(stateFor(outcome.run));
    const season = buildStudentSeasonChallengePayload(outcome.run);

    expect(history.metrics.learningActions).toBeGreaterThan(0);
    expect(history.learningSignals.some((signal) => signal.id === "opportunity" && signal.count === 1)).toBe(true);
    expect(season.objectives.find((objective) => objective.id === "opportunity-note")?.progress).toBe(1);
  });

  it("cleans unreadable legacy notes and dedupes identical entries", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const outcome = createOpportunityNote(run, {
      cardId: "safe-haven",
      reason: "risk-release",
      confidence: 54,
      note: "市场不确定性升高，我想观察黄金是否真的能降低组合波动。",
    });
    const firstAction = outcome.run.actionLog[0]!;
    const noisyRun = {
      ...outcome.run,
      actionLog: [
        firstAction,
        firstAction,
        {
          ...firstAction,
          id: "legacy-opportunity-noise",
          meta: {
            ...firstAction.meta,
            note: "??????",
          },
        },
      ],
    };

    const payload = buildOpportunityPayload(noisyRun);

    expect(payload.notes).toHaveLength(2);
    expect(payload.notes.some((entry) => entry.note.includes("无法识别"))).toBe(true);
  });
});
