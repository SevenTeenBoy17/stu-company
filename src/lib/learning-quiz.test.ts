import { describe, expect, it } from "vitest";

import { learningModules, moduleQuizzes } from "@/lib/content";

import { gradeQuiz, publicQuiz, quizFor } from "./learning-quiz";

describe("quiz dataset integrity", () => {
  it("every learning module has a quiz with valid answer indices", () => {
    for (const m of learningModules) {
      const quiz = quizFor(m.key);
      expect(quiz, `module ${m.key} has a quiz`).not.toBeNull();
      for (const item of quiz!) {
        expect(item.options.length).toBeGreaterThanOrEqual(2);
        expect(item.answer).toBeGreaterThanOrEqual(0);
        expect(item.answer).toBeLessThan(item.options.length);
      }
    }
  });

  it("correct answers are not all at index 0 (no always-first pattern)", () => {
    const answerIndices = Object.values(moduleQuizzes)
      .flat()
      .map((item) => item.answer);
    expect(new Set(answerIndices).size).toBeGreaterThan(1);
  });
});

describe("publicQuiz", () => {
  it("strips the answer key", () => {
    const pub = publicQuiz("equities");
    expect(pub).not.toBeNull();
    for (const item of pub!) {
      expect(item).not.toHaveProperty("answer");
      expect(item.q).toBeTruthy();
      expect(item.options.length).toBeGreaterThan(0);
    }
  });

  it("returns null for an unknown module", () => {
    expect(publicQuiz("nope")).toBeNull();
  });
});

describe("gradeQuiz (pass = >= 2/3)", () => {
  function correctAnswers(moduleKey: string): number[] {
    return quizFor(moduleKey)!.map((item) => item.answer);
  }

  it("passes a fully-correct attempt", () => {
    const result = gradeQuiz("equities", correctAnswers("equities"));
    expect(result).toEqual({ passed: true, correct: 3, total: 3 });
  });

  it("passes with exactly 2 of 3", () => {
    const answers = correctAnswers("equities");
    answers[0] = (answers[0] + 1) % 4; // make the first one wrong
    expect(gradeQuiz("equities", answers)).toMatchObject({ passed: true, correct: 2 });
  });

  it("fails with only 1 of 3", () => {
    const answers = correctAnswers("equities").map((a, i) => (i === 0 ? a : (a + 1) % 4));
    const result = gradeQuiz("equities", answers);
    expect(result!.passed).toBe(false);
    expect(result!.correct).toBe(1);
  });

  it("treats missing answers as wrong", () => {
    expect(gradeQuiz("equities", [])).toMatchObject({ passed: false, correct: 0, total: 3 });
  });

  it("returns null for an unknown module", () => {
    expect(gradeQuiz("nope", [0, 0, 0])).toBeNull();
  });
});
