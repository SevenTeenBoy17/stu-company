/**
 * Learning quiz grading (Option B). Answers are graded server-side and never
 * sent to the client (publicQuiz strips the answer key), so completion can't be
 * faked by reading the payload. Pass = at least two-thirds correct.
 */
import { moduleQuizzes, type QuizQuestion } from "@/lib/content";

export const QUIZ_PASS_RATIO = 2 / 3;

export function quizFor(moduleKey: string): QuizQuestion[] | null {
  return moduleQuizzes[moduleKey] ?? null;
}

/** Questions + options WITHOUT the answer key — safe to send to the browser. */
export function publicQuiz(moduleKey: string): { q: string; options: string[] }[] | null {
  const quiz = quizFor(moduleKey);
  return quiz ? quiz.map(({ q, options }) => ({ q, options })) : null;
}

export interface QuizResult {
  passed: boolean;
  correct: number;
  total: number;
}

export function gradeQuiz(moduleKey: string, answers: number[]): QuizResult | null {
  const quiz = quizFor(moduleKey);
  if (!quiz) return null;
  const total = quiz.length;
  const correct = quiz.reduce((n, item, i) => n + (answers[i] === item.answer ? 1 : 0), 0);
  const passed = total > 0 && correct >= Math.ceil(total * QUIZ_PASS_RATIO);
  return { passed, correct, total };
}
