"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { learningModules } from "@/lib/content";
import { cn } from "@/lib/utils";
import { ModuleIllustration } from "@/components/site/module-illustration";

const levelFilters = [
  { label: "全部", value: "all" },
  { label: "核心", value: "核心" },
  { label: "进阶", value: "进阶" },
  { label: "运营", value: "运营" },
  { label: "家校", value: "家校" },
] as const;

const levelTints: Record<string, string> = {
  "核心": "bg-[var(--amber-50)]",
  "进阶": "bg-[var(--info-50)]",
  "运营": "bg-[var(--down-50)]",
  "家校": "bg-[var(--warning-50)]",
};

const levelLabels: Record<string, string> = Object.fromEntries(
  levelFilters.filter((item) => item.value !== "all").map((item) => [item.value, item.label]),
);

type QuizPrompt = {
  question: string;
  options: string[];
};

type QuizModule = {
  key: string;
  title: string;
};

export function LearnCatalog() {
  const [activeLevel, setActiveLevel] = useState<(typeof levelFilters)[number]["value"]>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [completedKeys, setCompletedKeys] = useState<Set<string> | null>(null);
  const [learnTotal, setLearnTotal] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [quizModule, setQuizModule] = useState<QuizModule | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizPrompt[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizMessage, setQuizMessage] = useState<string | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  const filteredModules = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return learningModules.filter((module) => {
      const moduleLevel = module.level as string;
      const levelMatch = activeLevel === "all" || moduleLevel === activeLevel;
      const textMatch =
        !normalized ||
        [module.title, module.tagline, module.description, ...module.highlights]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return levelMatch && textMatch;
    });
  }, [activeLevel, deferredQuery]);

  useEffect(() => {
    let alive = true;
    void fetch("/api/learn/progress", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { progress?: { total: number; completedKeys: string[] } } | null) => {
        if (!alive || !data?.progress) return;
        setCompletedKeys(new Set(data.progress.completedKeys));
        setLearnTotal(data.progress.total);
      })
      .catch(() => {
        // Public visitors keep browsing the catalog without learning controls.
      });
    return () => {
      alive = false;
    };
  }, []);

  async function openQuiz(module: QuizModule) {
    if (pendingKey || completedKeys?.has(module.key)) return;
    setPendingKey(module.key);
    setQuizMessage(null);
    try {
      const response = await fetch(`/api/learn/quiz?moduleKey=${encodeURIComponent(module.key)}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data?.quiz)) {
        setQuizMessage(data?.message ?? "小测加载失败，请稍后再试。");
        return;
      }
      setQuizModule(module);
      setQuizQuestions(data.quiz);
      setQuizAnswers(Array(data.quiz.length).fill(-1));
    } finally {
      setPendingKey(null);
    }
  }

  async function submitQuiz() {
    if (!quizModule || quizSubmitting) return;
    if (quizAnswers.some((answer) => answer < 0)) {
      setQuizMessage("请先完成所有题目，再提交小测。");
      return;
    }

    setQuizSubmitting(true);
    setQuizMessage(null);
    try {
      const quizResponse = await fetch("/api/learn/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey: quizModule.key, answers: quizAnswers }),
      });
      const quizData = await quizResponse.json().catch(() => null);
      if (!quizResponse.ok || !quizData?.passed) {
        setQuizMessage(
          quizData?.score !== undefined
            ? `本次得分 ${quizData.score} 分，80 分及以上才算通过。请再复盘一遍课程重点。`
            : quizData?.message ?? "小测未通过，请再试一次。",
        );
        return;
      }

      const completeResponse = await fetch("/api/learn/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey: quizModule.key }),
      });
      const completeData = await completeResponse.json().catch(() => null);
      if (!completeResponse.ok || !completeData?.progress) {
        setQuizMessage(completeData?.message ?? "小测已通过，但学习记录更新失败，请稍后重试。");
        return;
      }

      setCompletedKeys(new Set(completeData.progress.completedKeys));
      setLearnTotal(completeData.progress.total);
      setQuizMessage(`小测通过，得分 ${quizData.score} 分。学习分已更新。`);
      setTimeout(() => {
        setQuizModule(null);
        setQuizQuestions([]);
        setQuizAnswers([]);
        setQuizMessage(null);
      }, 900);
    } finally {
      setQuizSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div data-motion-reveal className="panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            {levelFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                data-motion-button
                onClick={() => setActiveLevel(filter.value)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors",
                  activeLevel === filter.value
                    ? "bg-brand text-slate-950"
                    : "bg-slate-950/[0.04] text-slate-600 hover:bg-slate-950/[0.08]",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索课程、关键词或能力点"
            className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-brand lg:max-w-sm"
          />
        </div>
      </div>

      {completedKeys ? (
        <div data-motion-reveal className="panel flex flex-col gap-1 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-700">
            学习打卡：已通过{" "}
            <span className="font-bold text-brand-ink">
              {completedKeys.size}/{learnTotal}
            </span>{" "}
            个模块小测
          </p>
          <p className="text-xs text-slate-500">
            通过课后小测后才计入财商战力的“学习”分，避免纯点击刷分。
          </p>
        </div>
      ) : null}

      {filteredModules.length === 0 ? (
        <div data-motion-reveal className="panel rounded-3xl p-8 text-center">
          <p className="text-lg font-semibold text-slate-950">没有匹配的课程</p>
          <p className="mt-2 text-sm leading-7 text-slate-500">换个关键词，或清除筛选查看全部课程。</p>
          <button
            type="button"
            data-motion-button
            onClick={() => {
              setActiveLevel("all");
              setQuery("");
            }}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-slate-950 transition hover:bg-[var(--amber-600)]"
          >
            清除筛选
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {filteredModules.map((module) => (
            <article key={module.key} data-motion-card className="panel flex flex-col overflow-hidden rounded-3xl transition-shadow hover:shadow-lg">
              <div className={`p-4 ${levelTints[module.level as string] ?? "bg-[var(--ink-50)]"}`}>
                <ModuleIllustration moduleKey={module.key} className="h-52 w-full" />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="bz-brand-chip rounded-full px-3 py-1 text-xs font-semibold">
                    {levelLabels[module.level as string] ?? module.level}
                  </span>
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Brown Zone
                  </span>
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-slate-950">{module.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{module.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {module.highlights.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                  <Link
                    href={module.href}
                    target="_blank"
                    rel="noreferrer"
                    data-motion-button
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 shadow-sm transition-colors hover:bg-slate-800"
                  >
                    <span className="text-[0.95rem] font-bold tracking-[0.04em] text-white">
                      打开资料
                    </span>
                  </Link>
                  {completedKeys ? (
                    <button
                      type="button"
                      data-motion-button
                      onClick={() => openQuiz({ key: module.key, title: module.title })}
                      disabled={completedKeys.has(module.key) || pendingKey === module.key}
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition",
                        completedKeys.has(module.key)
                          ? "bg-[var(--amber-100)] text-brand-ink"
                          : "border border-slate-300 text-slate-700 hover:border-brand disabled:opacity-60",
                      )}
                    >
                      {completedKeys.has(module.key)
                        ? "已通过小测"
                        : pendingKey === module.key
                          ? "加载小测..."
                          : "课后小测"}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {quizModule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[calc(100svh-4rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-ink">Brown Zone Quiz</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">{quizModule.title} · 课后小测</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  答对 80 分及以上才会计入学习分。这里训练的是“先理解再决策”，不是点击刷分。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuizModule(null)}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-950"
              >
                关闭
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {quizQuestions.map((question, questionIndex) => (
                <section key={question.question} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-bold text-slate-950">
                    {questionIndex + 1}. {question.question}
                  </h3>
                  <div className="mt-4 grid gap-3">
                    {question.options.map((option, optionIndex) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          const next = [...quizAnswers];
                          next[questionIndex] = optionIndex;
                          setQuizAnswers(next);
                          setQuizMessage(null);
                        }}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition",
                          quizAnswers[questionIndex] === optionIndex
                            ? "border-brand bg-[var(--amber-50)] text-brand-ink"
                            : "border-white bg-white text-slate-600 hover:border-slate-300",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {quizMessage ? (
              <p className="mt-5 rounded-2xl bg-[var(--amber-50)] px-4 py-3 text-sm font-semibold leading-6 text-brand-ink">
                {quizMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setQuizModule(null)}
                className="min-h-11 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-400"
              >
                稍后再做
              </button>
              <button
                type="button"
                data-motion-button
                onClick={submitQuiz}
                disabled={quizSubmitting}
                className="min-h-11 rounded-full bg-brand px-6 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-[var(--amber-600)] disabled:opacity-60"
              >
                {quizSubmitting ? "评分中..." : "提交小测"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
