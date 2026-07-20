"use client";

import { useState } from "react";
import { LoaderCircle, Radar, RefreshCw } from "lucide-react";

import { Disclosure } from "@/components/shared/disclosure";
import type { InvestorPersona, TutorRadarPayload } from "@/lib/types";
import { cn, formatDateLabel } from "@/lib/utils";

const RADAR_SIZE = 260;
const CENTER = RADAR_SIZE / 2;
const RADIUS = 86;

function pointFor(index: number, total: number, radius: number) {
  const angle = (-90 + (360 / total) * index) * (Math.PI / 180);
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function buildRadarPath(scores: number[]) {
  return (
    scores
      .map((score, index) => {
        const point = pointFor(index, scores.length, (Math.max(0, Math.min(100, score)) / 100) * RADIUS);
        return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

export function StudentTutorRadar({
  payload,
  persona = null,
  personaShareText,
  loading = false,
  onRefresh,
}: {
  payload: TutorRadarPayload;
  persona?: InvestorPersona | null;
  personaShareText?: string;
  loading?: boolean;
  onRefresh: () => void;
}) {
  const scores = payload.metrics.map((metric) => metric.score);
  const radarPath = buildRadarPath(scores);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");

  async function sharePersona() {
    if (!personaShareText) return;
    if (!navigator.clipboard?.writeText) {
      setShareState("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(personaShareText);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 2000);
    } catch {
      setShareState("failed");
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-border bg-white shadow-lg shadow-slate-950/5">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-brand" />
            <p className="text-sm font-semibold text-fg-strong">AI 决策雷达</p>
          </div>
          <p className="mt-2 text-xs leading-6 text-fg-muted">
            {payload.provider === "remote" ? "远端模型已生成维度" : "本地规则生成维度"} ·{" "}
            {formatDateLabel(new Date(payload.asOf))}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3.5 text-xs font-semibold text-fg-default transition-colors hover:border-brand hover:text-brand-ink disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          一键更新雷达图
        </button>
      </div>

      <div className="grid gap-4 px-5 py-5">
        <div className="rounded-[1.35rem] bg-slate-950/[0.03] p-3">
          <svg aria-hidden="true" viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="mx-auto h-60 w-full max-w-[252px] sm:h-64">
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <polygon
                key={ratio}
                points={scores
                  .map((_, index) => {
                    const point = pointFor(index, scores.length, RADIUS * ratio);
                    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="var(--color-border)"
              />
            ))}
            {scores.map((_, index) => {
              const point = pointFor(index, scores.length, RADIUS);
              return (
                <line
                  key={`axis-${index}`}
                  x1={CENTER}
                  y1={CENTER}
                  x2={point.x}
                  y2={point.y}
                  stroke="var(--color-border)"
                />
              );
            })}
            <path d={radarPath} fill="color-mix(in srgb, var(--brand) 24%, transparent)" stroke="var(--brand)" strokeWidth="3" />
            <circle cx={CENTER} cy={CENTER} r="4" fill="var(--brand)" />
          </svg>
        </div>

        <div className="min-w-0">
          {persona ? (
            <div className="mb-3 rounded-[1.35rem] border border-brand-warm bg-gradient-to-br from-brand-subtle to-brand-soft px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-950">
                  高级版 · 投资人格
                </span>
                <span className="min-w-0 text-base font-bold text-brand-ink">{persona.label}</span>
              </div>
              <p className="mt-2 text-xs leading-6 text-brand-ink/80">{persona.summary}</p>
              {personaShareText ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={sharePersona}
                    className="rounded-full border border-brand-warm bg-white px-3 py-1.5 text-xs font-bold text-brand-ink transition-colors hover:bg-brand-subtle"
                  >
                    {shareState === "copied" ? "已复制，去分享吧" : "复制分享我的投资人格"}
                  </button>
                  <span role="status" aria-live="polite" className="sr-only">
                    {shareState === "copied"
                      ? "已复制到剪贴板"
                      : shareState === "failed"
                        ? "复制失败，请手动复制下方文字"
                        : ""}
                  </span>
                  {shareState === "failed" ? (
                    <div className="mt-2">
                      <p className="text-xs text-fg-muted">复制失败，请长按下方文字手动复制：</p>
                      <textarea
                        readOnly
                        value={personaShareText}
                        onFocus={(event) => event.currentTarget.select()}
                        className="mt-1 min-h-20 w-full rounded-lg border border-border bg-bg-muted p-2 text-xs text-fg-default"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="rounded-[1.35rem] bg-brand-subtle px-4 py-3 text-sm font-semibold leading-7 text-brand-ink">
            {payload.summary}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {payload.metrics.map((metric) => (
              <div key={metric.id} className="rounded-[1.2rem] bg-slate-950/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-fg-strong">{metric.label}</p>
                  <p className="text-lg font-bold text-brand-ink">{metric.score}</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div
                    className={cn("h-full rounded-full", metric.score >= 70 ? "bg-brand" : "bg-brand-warm")}
                    style={{ width: `${Math.max(6, metric.score)}%` }}
                  />
                </div>
                <Disclosure
                  summary="查看解读"
                  className="mt-1"
                  summaryClassName="px-0 py-1 text-xs font-medium text-fg-muted"
                  panelClassName="pb-1 pt-0 text-xs leading-5 text-fg-muted"
                >
                  {metric.note}
                </Disclosure>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
