"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PowerCard } from "./power-card";
import { RankBoard } from "./rank-board";
import { RankOnboarding, type RankOnboardingInitial } from "./rank-onboarding";
import type { FormulaDTO, PowerCardDTO, RankScope } from "./types";

interface MeResponse {
  card: PowerCardDTO;
  formula: FormulaDTO;
}

export function RankDashboard() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped after onboarding to re-run the fetch effect (setState stays inside
  // the async callbacks, per the codebase's effect pattern).
  const [refreshKey, setRefreshKey] = useState(0);
  // Region scope is lifted here so the hero's per-region tiles and the board's
  // own selector stay in sync — clicking 全国 on either drives the same board.
  const [scope, setScope] = useState<RankScope>("school");
  const [editing, setEditing] = useState(false);
  const [editInitial, setEditInitial] = useState<RankOnboardingInitial | null>(null);
  const [openingEdit, setOpeningEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function openEdit() {
    if (openingEdit) return;
    setOpeningEdit(true);
    setEditError(null);
    try {
      const res = await fetch("/api/leaderboard/profile", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as
        | {
            profile?: {
              provinceCode: string;
              cityCode: string;
              alias: string;
              visibility: RankOnboardingInitial["visibility"];
              consent: number;
            };
            schoolName?: string;
          }
        | null;
      if (!payload?.profile) {
        setEditError("无法加载档案，请稍后重试。");
        return;
      }
      setEditInitial({
        provinceCode: payload.profile.provinceCode,
        cityCode: payload.profile.cityCode,
        schoolName: payload.schoolName ?? "",
        alias: payload.profile.alias,
        visibility: payload.profile.visibility,
        consent: Boolean(payload.profile.consent),
      });
      setEditing(true);
    } catch {
      setEditError("网络异常，请稍后重试。");
    } finally {
      setOpeningEdit(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const response = await fetch("/api/leaderboard/me", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as (MeResponse & { message?: string }) | null;
        if (!alive) return;
        if (!response.ok || !payload) {
          setData(null);
          setLoadError(payload?.message ?? "战力数据暂时加载失败，请稍后重试。");
          return;
        }
        setData(payload);
      } catch {
        if (alive) {
          setData(null);
          setLoadError("网络连接不稳定，战力数据暂时加载失败。");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[1.7rem] border border-border bg-white p-12 text-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">加载战力数据…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[1.7rem] border border-[var(--error-100)] bg-[var(--error-50)] p-6">
        <p className="text-sm font-bold text-[var(--error-600)]">{loadError}</p>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-fg-default shadow-sm transition hover:-translate-y-0.5"
        >
          重新加载战力数据
        </button>
      </div>
    );
  }

  if (!data || !data.card.hasProfile) {
    return <RankOnboarding onComplete={() => setRefreshKey((k) => k + 1)} />;
  }

  if (editing && editInitial) {
    return (
      <RankOnboarding
        initial={editInitial}
        onCancel={() => setEditing(false)}
        onComplete={() => {
          setEditing(false);
          setRefreshKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={openEdit}
          disabled={openingEdit}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-1.5 text-xs font-semibold text-fg-default transition hover:border-brand/40 disabled:opacity-60"
        >
          {openingEdit ? "正在打开…" : "编辑档案 / 隐私设置"}
        </button>
        {editError ? (
          <p className="text-xs font-medium text-[var(--error-500)]">{editError}</p>
        ) : null}
      </div>
      <PowerCard
        card={data.card}
        formula={data.formula}
        scope={scope}
        onScopeChange={setScope}
      />
      <RankBoard scope={scope} onScopeChange={setScope} />
    </div>
  );
}
