"use client";

import { useState } from "react";
import { LoaderCircle, Radar, RefreshCw } from "lucide-react";

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
  const [shared, setShared] = useState(false);

  async function sharePersona() {
    if (!personaShareText) return;
    try {
      await navigator.clipboard.writeText(personaShareText);
      setShared(true);
    } catch {
      setShared(false);
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-[#f08a38]" />
            <p className="text-sm font-semibold text-slate-950">AI 决策雷达</p>
          </div>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            {payload.provider === "remote" ? "远端模型已生成维度" : "本地规则生成维度"} ·{" "}
            {formatDateLabel(new Date(payload.asOf))}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#f08a38] hover:text-[#b96621] disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          一键更新雷达图
        </button>
      </div>

      <div className="grid gap-4 px-5 py-5">
        <div className="rounded-[1.35rem] bg-slate-950/[0.03] p-3">
          <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="mx-auto h-60 w-full max-w-[252px] sm:h-64">
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
                stroke="rgba(15,23,42,0.09)"
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
                  stroke="rgba(15,23,42,0.09)"
                />
              );
            })}
            <path d={radarPath} fill="rgba(240,138,56,0.24)" stroke="#f08a38" strokeWidth="3" />
            <circle cx={CENTER} cy={CENTER} r="4" fill="#f08a38" />
          </svg>
        </div>

        <div className="min-w-0">
          {persona ? (
            <div className="mb-3 rounded-[1.35rem] border border-[#f0c89a] bg-gradient-to-br from-[#fff7ee] to-[#ffeede] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#f08a38] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  高级版 · 投资人格
                </span>
                <span className="text-base font-black text-[#7a4717]">{persona.label}</span>
              </div>
              <p className="mt-2 text-xs leading-6 text-[#9a6a3a]">{persona.summary}</p>
              {personaShareText ? (
                <button
                  type="button"
                  onClick={sharePersona}
                  className="mt-3 rounded-full border border-[#f0c89a] bg-white px-3 py-1.5 text-xs font-bold text-[#b96621] transition-colors hover:bg-[#fff7ee]"
                >
                  {shared ? "已复制，去分享吧" : "复制分享我的投资人格"}
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="rounded-[1.35rem] bg-[#fff4e9] px-4 py-3 text-sm font-semibold leading-7 text-[#7a4717]">
            {payload.summary}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {payload.metrics.map((metric) => (
              <div key={metric.id} className="rounded-[1.2rem] bg-slate-950/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{metric.label}</p>
                  <p className="text-lg font-bold text-[#d43c33]">{metric.score}</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div
                    className={cn("h-full rounded-full", metric.score >= 70 ? "bg-[#d43c33]" : "bg-[#f08a38]")}
                    style={{ width: `${Math.max(6, metric.score)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{metric.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
