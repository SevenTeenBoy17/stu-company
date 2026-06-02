"use client";

import { motion } from "framer-motion";
import { Crown, Info, TrendingUp } from "lucide-react";

import {
  COMPONENT_LABELS,
  SCOPE_LABELS,
  type ComponentsDTO,
  type FormulaDTO,
  type PowerCardDTO,
  type RankScope,
} from "./types";

const SCOPE_ORDER: RankScope[] = ["school", "city", "province", "nation"];

function tierAccent(tier: number): string {
  // Neutral -> gold ramp; avoids the market red/green so tiers never read as P&L.
  return (
    [
      "from-slate-400 to-slate-500",
      "from-sky-400 to-sky-600",
      "from-indigo-400 to-indigo-600",
      "from-violet-400 to-violet-600",
      "from-[var(--amber-400)] to-[var(--amber-600)]",
      "from-amber-400 via-yellow-300 to-amber-500",
    ][Math.min(Math.max(tier, 1), 6) - 1] ?? "from-slate-400 to-slate-500"
  );
}

export function PowerCard({ card, formula }: { card: PowerCardDTO; formula: FormulaDTO }) {
  const rows = (Object.keys(formula.weights) as (keyof ComponentsDTO)[]).map((key) => {
    const weight = formula.weights[key];
    const value = card.components?.[key] ?? 0;
    return {
      key,
      label: COMPONENT_LABELS[key],
      weightPct: Math.round(weight * 100),
      valuePct: Math.round(value * 100),
      points: Math.round(weight * value * formula.maxPower),
    };
  });

  const nextTierGap = card.toNextTier;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative overflow-hidden rounded-[1.7rem] bg-gradient-to-br ${tierAccent(card.tier.tier)} p-6 text-white shadow-[0_18px_44px_rgba(15,23,42,0.16)]`}
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Crown className="h-3.5 w-3.5" /> {card.tier.name}
          </span>
          <span className="text-xs font-medium text-white/80">{card.periodKey} · 周榜</span>
        </div>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-white/75">财商战力</p>
          <p className="mt-1 font-mono text-5xl font-black tabular-nums leading-none">
            {card.power.toLocaleString("zh-CN")}
          </p>
          {card.alias ? <p className="mt-2 text-sm font-medium text-white/85">{card.alias}</p> : null}
        </div>

        {nextTierGap > 0 ? (
          <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90">
            <TrendingUp className="h-3.5 w-3.5" /> 距下一段位还差 {nextTierGap} 战力
          </p>
        ) : (
          <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90">
            <TrendingUp className="h-3.5 w-3.5" /> 已达最高段位，保持住！
          </p>
        )}

        {/* 4-scope ranks */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {SCOPE_ORDER.map((scope) => {
            const rank = card.ranks[scope];
            return (
              <div key={scope} className="rounded-xl bg-white/15 px-2 py-2.5 text-center backdrop-blur">
                <p className="text-[0.68rem] font-medium text-white/75">{SCOPE_LABELS[scope]}</p>
                <p className="mt-0.5 font-mono text-base font-bold tabular-nums">
                  {rank ? `#${rank}` : "—"}
                </p>
              </div>
            );
          })}
        </div>

        {!card.ranked ? (
          <p className="mt-3 text-[0.7rem] leading-4 text-white/75">
            完成一局沙盘即可生成战力并参与排名。
          </p>
        ) : card.consent !== 1 ? (
          <p className="mt-3 text-[0.7rem] leading-4 text-white/75">
            获得家长 / 监护人同意后即可登上公开榜单。以上名次仅你自己可见。
          </p>
        ) : card.visibility === "hidden" ? (
          <p className="mt-3 text-[0.7rem] leading-4 text-white/75">
            你已开启「隐身」，以下名次仅自己可见，不会出现在公开榜单。
          </p>
        ) : card.visibility === "school_only" ? (
          <p className="mt-3 text-[0.7rem] leading-4 text-white/75">
            你当前「仅校内」可见，校外榜单不显示你的昵称。
          </p>
        ) : null}
      </motion.section>

      {/* Transparency panel — decision 1: show composition + weights */}
      <section className="rounded-[1.7rem] border border-border bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold text-fg-default">战力是怎么算出来的</h3>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-fg-muted">
          满分 {formula.maxPower}。每项 = 该项表现 × 权重 × 满分。比的是决策质量，运气好乱赌不会更高。
        </p>

        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-fg-default">
                  {row.label}
                  <span className="ml-1.5 rounded-full bg-bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-fg-muted">
                    权重 {row.weightPct}%
                  </span>
                </span>
                <span className="font-mono tabular-nums text-fg-muted">+{row.points}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-muted">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${row.valuePct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>

        {!card.components ? (
          <p className="mt-4 rounded-xl bg-bg-muted px-3 py-2 text-xs text-fg-muted">
            完成一局沙盘后，这里会展开你每一项的真实得分。
          </p>
        ) : null}
      </section>
    </div>
  );
}
