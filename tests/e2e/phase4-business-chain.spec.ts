import { expect, test, type APIResponse } from "playwright/test";

const PASSWORD = "Phase4Run2026";
const MODULE_KEY = "equities";

async function expectOk(response: APIResponse, label: string) {
  if (!response.ok()) {
    throw new Error(`${label} failed: ${response.status()} ${await response.text()}`);
  }
  return response;
}

function answerCombinations(questionCount: number, optionCount = 4) {
  const total = Math.pow(optionCount, questionCount);
  return Array.from({ length: total }, (_, value) =>
    Array.from({ length: questionCount }, (_unused, index) => Math.floor(value / Math.pow(optionCount, index)) % optionCount),
  );
}

test.describe("Phase 4.1 real DB business chain", () => {
  test("registers, logs in, persists sandbox, auto-invest, risk profile, and quiz progress", async ({ page }) => {
    test.setTimeout(120_000);

    const email = `phase4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@brownzone.test`;

    const register = await page.request.post("/api/auth/register", {
      data: {
        name: "阶段四学生",
        email,
        password: PASSWORD,
      },
    });
    await expectOk(register, "register");
    await expect(register.json()).resolves.toMatchObject({ redirectTo: "/student" });

    const logout = await page.request.post("/api/auth/logout");
    await expectOk(logout, "logout");

    const login = await page.request.post("/api/auth/login", {
      data: { email, password: PASSWORD },
    });
    await expectOk(login, "login");
    await expect(login.json()).resolves.toMatchObject({ redirectTo: "/student" });

    const beforeStateResponse = await page.request.get("/api/sim/state");
    await expectOk(beforeStateResponse, "sim state before");
    const beforeState = await beforeStateResponse.json();
    const beforeRound = beforeState.state.run.currentRound;

    const advance = await page.request.post("/api/sim/advance-round");
    await expectOk(advance, "advance one round");
    const advanced = await advance.json();
    expect(advanced.state.run.currentRound).toBe(beforeRound + 1);

    const afterStateResponse = await page.request.get("/api/sim/state");
    await expectOk(afterStateResponse, "sim state after refresh");
    const afterState = await afterStateResponse.json();
    expect(afterState.state.run.currentRound).toBe(beforeRound + 1);

    const autoInvestSeed = await page.request.get("/api/student/auto-invest");
    await expectOk(autoInvestSeed, "auto-invest seed");
    const autoInvestPayload = await autoInvestSeed.json();
    const selected = autoInvestPayload.payload.selected;
    const activateAutoInvest = await page.request.post("/api/student/auto-invest", {
      data: {
        intent: "activate",
        assetId: selected.assetId,
        amountPerRound: 500,
        durationRounds: 2,
        strategy: "steady",
      },
    });
    await expectOk(activateAutoInvest, "activate auto-invest");

    const autoInvestRefresh = await page.request.get("/api/student/auto-invest");
    await expectOk(autoInvestRefresh, "auto-invest refresh");
    const refreshedAutoInvest = await autoInvestRefresh.json();
    expect(refreshedAutoInvest.payload.activePlan).toMatchObject({
      status: "active",
      assetId: selected.assetId,
      amountPerRound: 500,
      durationRounds: 2,
      strategy: "steady",
    });

    const riskSeed = await page.request.get("/api/student/risk-profile");
    await expectOk(riskSeed, "risk profile seed");
    const riskPayload = await riskSeed.json();
    const answers = riskPayload.payload.questions.map((question: { id: string; options: Array<{ id: string }> }) => ({
      questionId: question.id,
      optionId: question.options[1]?.id ?? question.options[0].id,
    }));

    const submitRisk = await page.request.post("/api/student/risk-profile", {
      data: { answers },
    });
    await expectOk(submitRisk, "risk profile submit");
    const submittedRisk = await submitRisk.json();
    expect(submittedRisk.persisted).toBe(true);

    const riskRefresh = await page.request.get("/api/student/risk-profile");
    await expectOk(riskRefresh, "risk profile refresh");
    const refreshedRisk = await riskRefresh.json();
    expect(refreshedRisk.persisted).toBe(true);
    expect(refreshedRisk.payload.selectedAnswers).toEqual(answers);

    const quizPrompt = await page.request.get(`/api/learn/quiz?moduleKey=${MODULE_KEY}`);
    await expectOk(quizPrompt, "quiz prompt");
    const quiz = await quizPrompt.json();
    expect(Array.isArray(quiz.quiz)).toBe(true);
    expect(quiz.quiz.length).toBeGreaterThan(0);

    let passedQuiz: { passed: boolean; score: number } | null = null;
    for (const answersCandidate of answerCombinations(quiz.quiz.length)) {
      const grade = await page.request.post("/api/learn/quiz", {
        data: { moduleKey: MODULE_KEY, answers: answersCandidate },
      });
      await expectOk(grade, "quiz grade");
      const body = await grade.json();
      if (body.passed) {
        passedQuiz = body;
        break;
      }
    }
    expect(passedQuiz, "one answer combination should pass the server-graded quiz").not.toBeNull();
    expect(passedQuiz?.score).toBeGreaterThanOrEqual(80);

    const complete = await page.request.post("/api/learn/complete", {
      data: { moduleKey: MODULE_KEY },
    });
    await expectOk(complete, "complete module after quiz");
    const completed = await complete.json();
    expect(completed.progress.completedKeys).toContain(MODULE_KEY);

    const progressRefresh = await page.request.get("/api/learn/progress");
    await expectOk(progressRefresh, "learning progress refresh");
    const progress = await progressRefresh.json();
    expect(progress.progress.completedKeys).toContain(MODULE_KEY);

    await page.goto("/student", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(/学生|策略|沙盘|Brown Zone/);
    await expect(page.getByText(/This page couldn't load/i)).toHaveCount(0);
  });
});
