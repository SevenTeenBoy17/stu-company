"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { learningModules } from "@/lib/content";
import { cn } from "@/lib/utils";
import { ModuleIllustration } from "@/components/site/module-illustration";

const levelFilters = ["全部", "核心", "进阶", "运营", "家校"] as const;

const levelTints: Record<string, string> = {
  "核心": "bg-[var(--amber-50)]",
  "进阶": "bg-[var(--info-50)]",
  "运营": "bg-[var(--down-50)]",
  "家校": "bg-[var(--warning-50)]",
};

export function LearnCatalog() {
  const [activeLevel, setActiveLevel] = useState<(typeof levelFilters)[number]>("全部");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  // Seed the search from a ?q= param (e.g. arriving from the header search).
  // Client-only effect so SSR never touches window.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  const filteredModules = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return learningModules.filter((module) => {
      const levelMatch = activeLevel === "全部" || module.level === activeLevel;
      const textMatch =
        !normalized ||
        [module.title, module.tagline, module.description, ...module.highlights]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return levelMatch && textMatch;
    });
  }, [activeLevel, deferredQuery]);

  // Learning 打卡 (Option A). null = not a logged-in student → controls hidden,
  // public visitors see the catalog unchanged.
  const [completedKeys, setCompletedKeys] = useState<Set<string> | null>(null);
  const [learnTotal, setLearnTotal] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/learn/progress", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { progress?: { total: number; completedKeys: string[] } } | null) => {
        if (!alive || !data?.progress) return;
        setCompletedKeys(new Set(data.progress.completedKeys));
        setLearnTotal(data.progress.total);
      })
      .catch(() => {
        // public visitor / not logged in — leave controls hidden
      });
    return () => {
      alive = false;
    };
  }, []);

  async function markLearned(key: string) {
    if (pendingKey || completedKeys?.has(key)) return;
    setPendingKey(key);
    try {
      const res = await fetch("/api/learn/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey: key }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.progress) {
        setCompletedKeys(new Set(data.progress.completedKeys));
        setLearnTotal(data.progress.total);
      }
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-8">
      <div data-motion-reveal className="panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            {levelFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                data-motion-button
                onClick={() => setActiveLevel(filter)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors",
                  activeLevel === filter
                    ? "bg-brand text-slate-950"
                    : "bg-slate-950/[0.04] text-slate-600 hover:bg-slate-950/[0.08]",
                )}
              >
                {filter}
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
            学习打卡：已完成{" "}
            <span className="font-bold text-brand-ink">
              {completedKeys.size}/{learnTotal}
            </span>{" "}
            个模块
          </p>
          <p className="text-xs text-slate-500">完成学习可提升财商战力的「学习」分（占总分 15%）</p>
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
              setActiveLevel("全部");
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
            <div className={`p-4 ${levelTints[module.level] ?? "bg-[var(--ink-50)]"}`}>
              <ModuleIllustration moduleKey={module.key} className="h-52 w-full" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="bz-brand-chip rounded-full px-3 py-1 text-xs font-semibold">
                  {module.level}
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
                  href="/demo"
                  data-motion-button
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 shadow-sm transition-colors hover:bg-slate-800"
                >
                  {/* White label lives on a <span>: the global `a { color: inherit }`
                      reset targets the anchor and beats `text-white` there, but a
                      span has no competing rule so the utility wins cleanly. */}
                  <span className="text-[0.95rem] font-bold tracking-[0.04em] text-white">立即学习</span>
                </Link>
                {completedKeys ? (
                  <button
                    type="button"
                    data-motion-button
                    onClick={() => markLearned(module.key)}
                    disabled={completedKeys.has(module.key) || pendingKey === module.key}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition",
                      completedKeys.has(module.key)
                        ? "bg-[var(--amber-100)] text-brand-ink"
                        : "border border-slate-300 text-slate-700 hover:border-brand disabled:opacity-60",
                    )}
                  >
                    {completedKeys.has(module.key)
                      ? "已学完 ✓"
                      : pendingKey === module.key
                        ? "记录中…"
                        : "学完打卡"}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
          ))}
        </div>
      )}
    </div>
  );
}
