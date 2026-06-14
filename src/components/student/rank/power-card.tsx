"use client";

import { useState } from "react";
import { Check, Crown, Info, Share2, TrendingUp, X } from "lucide-react";

import { buildPowerShareText } from "@/lib/leaderboard/share";
import { cn } from "@/lib/utils";

import {
  aliasInfo,
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

export function PowerCard({
  card,
  formula,
  scope: selectedScope,
  onScopeChange,
}: {
  card: PowerCardDTO;
  formula: FormulaDTO;
  scope: RankScope;
  onScopeChange: (next: RankScope) => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");

  async function share() {
    const text = buildPowerShareText({
      power: card.power,
      tierName: card.tier.name,
      ranks: card.ranks,
    });
    try {
      await navigator.clipboard.writeText(text);
      setShareState("copied");
    } catch {
      // clipboard blocked (e.g. insecure context)
      setShareState("failed");
    }
    window.setTimeout(() => setShareState("idle"), 2000);
  }

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
  // Progress through the current tier band toward the next one — a filled bar
  // reads as "almost there" far more strongly than a bare number does.
  const tierFloor = card.tier.min;
  const nextTierFloor = card.power + nextTierGap;
  const tierProgress =
    nextTierFloor > tierFloor
      ? Math.min(1, Math.max(0, (card.power - tierFloor) / (nextTierFloor - tierFloor)))
      : 1;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
      {/* Hero */}
      <section
        data-motion-reveal
        className={`relative overflow-hidden rounded-[1.7rem] bg-gradient-to-br ${tierAccent(card.tier.tier)} p-6 text-white shadow-[0_18px_44px_rgba(15,23,42,0.16)]`}
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Crown className="h-3.5 w-3.5" /> {card.tier.name}
          </span>
          {card.ranked ? (
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur transition hover:bg-white/30"
            >
              {shareState === "copied" ? (
                <Check className="h-3.5 w-3.5" />
              ) : shareState === "failed" ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              {shareState === "copied" ? "已复制" : shareState === "failed" ? "复制失败" : "分享战绩"}
            </button>
          ) : (
            <span className="text-xs font-medium text-white/80">{card.seasonName} · 本周榜</span>
          )}
        </div>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-white/75">
            财商战力
            <span className="ml-1.5 normal-case tracking-normal text-white/60">· {card.seasonName} 本周榜</span>
          </p>
          <p className="mt-1 font-mono text-5xl font-black tabular-nums leading-none">
            {card.power.toLocaleString("zh-CN")}
          </p>
          {card.alias ? (
            <p className="mt-2 text-sm font-medium text-white/85">{aliasInfo(card.alias).name}</p>
          ) : null}
        </div>

        {nextTierGap > 0 ? (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-medium text-white/90">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> 冲刺下一段位
              </span>
              <span className="font-mono tabular-nums">
                还差 {nextTierGap.toLocaleString("zh-CN")} 战力
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div
                data-motion-bar
                data-motion-delay="0.25"
                className="h-full rounded-full bg-white/90"
                style={{ width: `${Math.round(tierProgress * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-5 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90">
            <TrendingUp className="h-3.5 w-3.5" /> 已达最高段位，保持住！
          </p>
        )}

        {/* 4-scope ranks — each tile selects that region for the board below. */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {SCOPE_ORDER.map((scopeKey) => {
            const rank = card.ranks[scopeKey];
            const isTop = rank === 1;
            const isSelected = selectedScope === scopeKey;
            return (
              <button
                key={scopeKey}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  onScopeChange(scopeKey);
                  document
                    .getElementById("rank-board")
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
                className={cn(
                  "relative cursor-pointer rounded-xl px-2 py-2.5 text-center backdrop-blur transition",
                  // Darker underlay so the white label/number clear AA over the
                  // gradient; #1 keeps its gold identity via ring + crown.
                  isTop ? "bg-black/15 ring-1 ring-amber-300/80" : "bg-black/15 hover:bg-black/25",
                  isSelected && "ring-2 ring-white/90",
                )}
              >
                {isTop ? (
                  <Crown className="absolute right-1.5 top-1.5 h-3 w-3 text-amber-200" />
                ) : null}
                <p className="text-[0.68rem] font-semibold text-white/90">{SCOPE_LABELS[scopeKey]}</p>
                <p className="mt-0.5 font-mono text-base font-bold tabular-nums">
                  {rank ? `#${rank}` : "—"}
                </p>
              </button>
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
      </section>

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
