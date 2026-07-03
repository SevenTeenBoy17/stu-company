import { describe, expect, it } from "vitest";

import {
  getLearningModuleQuizPrompt,
  gradeLearningModuleQuiz,
  learningModules,
} from "@/lib/content";

describe("learning module quiz content", () => {
  it("serves quiz prompts without answer indexes", () => {
    const quiz = getLearningModuleQuizPrompt(learningModules[0]!.key);

    expect(quiz).toBeTruthy();
    expect(JSON.stringify(quiz)).not.toContain("answerIndex");
    expect(quiz?.[0]).toEqual({
      question: expect.any(String),
      options: expect.any(Array),
    });
  });

  it("grades module answers server-side", () => {
    const moduleKey = learningModules[0]!.key;

    expect(gradeLearningModuleQuiz(moduleKey, [0, 1])).toMatchObject({
      passed: true,
      score: 100,
    });
    expect(gradeLearningModuleQuiz(moduleKey, [0, 0])).toMatchObject({
      passed: false,
      score: 50,
    });
  });
});
