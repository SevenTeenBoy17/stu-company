"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface QuizQuestion {
  q: string;
  options: string[];
}

interface QuizResult {
  passed: boolean;
  correct: number;
  total: number;
}

export function QuizModal({
  moduleKey,
  moduleTitle,
  onClose,
  onPassed,
}: {
  moduleKey: string;
  moduleTitle: string;
  onClose: () => void;
  onPassed: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/learn/quiz?moduleKey=${moduleKey}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ questions: QuizQuestion[] }>) : null))
      .then((data) => {
        if (alive) setQuestions(data?.questions ?? []);
      })
      .catch(() => {
        if (alive) setQuestions([]);
      });
    return () => {
      alive = false;
    };
  }, [moduleKey]);

  const allAnswered = Boolean(questions && questions.every((_, i) => answers[i] !== undefined));

  async function submit() {
    if (!questions || !allAnswered || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const arr = questions.map((_, i) => answers[i]);
      const res = await fetch("/api/learn/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, answers: arr }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setResult({ passed: data.passed, correct: data.correct, total: data.total });
        if (data.passed) onPassed();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${moduleTitle} 测验`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">学完测验 · 答对 2/3 解锁</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">{moduleTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!questions ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <ol className="mt-5 space-y-5">
              {questions.map((question, qi) => (
                <li key={qi}>
                  <p className="text-sm font-semibold text-slate-800">
                    {qi + 1}. {question.q}
                  </p>
                  <div className="mt-2 space-y-2">
                    {question.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition",
                          answers[qi] === oi
                            ? "border-brand bg-[var(--amber-50)] text-slate-900"
                            : "border-slate-200 text-slate-700 hover:border-brand/40",
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          checked={answers[qi] === oi}
                          onChange={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                          className="h-4 w-4 accent-brand"
                          disabled={result?.passed}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>

            {result ? (
              <div
                className={cn(
                  "mt-5 rounded-xl px-4 py-3 text-sm font-semibold",
                  result.passed
                    ? "bg-[var(--amber-50)] text-brand-ink"
                    : "bg-red-50 text-red-700",
                )}
              >
                {result.passed ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> 答对 {result.correct}/{result.total}，测验通过！学习分已计入战力。
                  </span>
                ) : (
                  <>答对 {result.correct}/{result.total}，再复习一下重新挑战～</>
                )}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-3">
              {result?.passed ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white"
                >
                  完成
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!allAnswered || submitting}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {result ? "再试一次" : "提交测验"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
