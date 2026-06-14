import { describe, expect, it } from "vitest";

import { buildStudentPetPayload } from "@/lib/pet-rewards";
import { buildPortfolioIntel } from "@/lib/portfolio-intel";
import { buildSimulationState, createInitialRun } from "@/lib/simulation";
import { buildStudentHomeHubPayload } from "@/lib/student-service-map";
import { buildTutorRadarPayload } from "@/lib/tutor-radar";
import type { Classroom, ScenarioRun, SimulationState, UserRecord } from "@/lib/types";

function expectFiniteNumbers(value: unknown) {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(expectFiniteNumbers);
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach(expectFiniteNumbers);
  }
}

function buildEmptyRun(): ScenarioRun {
  const run = createInitialRun("student-empty", "classroom-empty", "空白测试沙盘", 20260614);
  run.holdings = [];
  run.actionLog = [];
  run.propertyUnits = 0;
  run.propertyBasis = 0;
  run.ventureStake = 0;
  run.ventureBasis = 0;
  run.snapshots = [
    {
      round: 1,
      netWorth: run.cash + run.savings - run.debt,
      cash: run.cash,
      savings: run.savings,
      debt: run.debt,
      riskScore: 55,
      disciplineScore: 72,
      reflection: "初始化空白沙盘。",
    },
  ];
  run.netWorth = run.snapshots[0].netWorth;
  return run;
}

function buildState(run: ScenarioRun): SimulationState {
  const user: UserRecord = {
    id: run.userId,
    email: "student-empty@example.com",
    passwordHash: "hash",
    role: "student",
    name: "空白学生",
    title: "新手观察员",
    classroomId: run.classroomId,
  };
  const classroom: Classroom = {
    id: run.classroomId,
    name: "空白测试班",
    region: "成都",
    teacherId: "teacher-empty",
    challengeTheme: "新手自愈测试",
    schoolRank: 1,
  };

  return buildSimulationState(user, classroom, run, [run], [user]);
}

describe("student dashboard payload builders", () => {
  it("builds safe student dashboard payloads for an empty new run", () => {
    const run = buildEmptyRun();
    const state = buildState(run);

    const homeHub = buildStudentHomeHubPayload(run);
    const pet = buildStudentPetPayload(run);
    const portfolioIntel = buildPortfolioIntel(state);
    const tutorRadar = buildTutorRadarPayload(state);

    expect(homeHub.today).toHaveLength(4);
    expect(homeHub.serviceMap.length).toBeGreaterThan(0);
    expect(homeHub.marketTemperature.score).toBeGreaterThanOrEqual(0);
    expect(pet.rewards.length).toBeGreaterThan(0);
    expect(pet.summary.total).toBe(pet.rewards.length);
    expect(portfolioIntel.allocation.length).toBeGreaterThan(0);
    expect(portfolioIntel.targetAllocation.length).toBeGreaterThan(0);
    expect(tutorRadar.metrics).toHaveLength(6);

    expectFiniteNumbers(homeHub);
    expectFiniteNumbers(pet);
    expectFiniteNumbers(portfolioIntel);
    expectFiniteNumbers(tutorRadar);
  });
});
