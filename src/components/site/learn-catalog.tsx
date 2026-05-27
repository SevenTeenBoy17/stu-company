"use client";

import { useDeferredValue, useMemo, useState } from "react";
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

  return (
    <div className="space-y-8">
      <div className="panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            {levelFilters.map((filter) => (
              <button
                key={filter}
                type="button"
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

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {filteredModules.map((module) => (
          <article key={module.key} className="panel overflow-hidden rounded-3xl transition-shadow hover:shadow-lg">
            <div className={`p-4 ${levelTints[module.level] ?? "bg-[var(--ink-50)]"}`}>
              <ModuleIllustration moduleKey={module.key} className="h-52 w-full" />
            </div>
            <div className="p-6">
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
              <Link
                href="/demo"
                className="mt-6 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white"
              >
                开始体验
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
