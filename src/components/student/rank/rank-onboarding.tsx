"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, School2, ShieldCheck } from "lucide-react";

import type { RankVisibility } from "./types";

interface Option {
  code: string;
  name: string;
}

const VISIBILITY_OPTIONS: { value: RankVisibility; label: string; hint: string }[] = [
  { value: "public", label: "公开", hint: "全国/省/市/校都可见你的昵称与学习点" },
  { value: "school_only", label: "仅校内", hint: "只在本校榜单出现，对外不显示" },
  { value: "hidden", label: "隐身", hint: "只自己可见学习点，不进入任何榜单" },
];

export interface RankOnboardingInitial {
  provinceCode: string;
  cityCode: string;
  schoolName: string;
  alias: string;
  visibility: RankVisibility;
  consent: boolean;
}

export function RankOnboarding({
  onComplete,
  initial,
  onCancel,
}: {
  onComplete: () => void;
  initial?: RankOnboardingInitial;
  onCancel?: () => void;
}) {
  const editing = Boolean(initial);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [citySchools, setCitySchools] = useState<string[]>([]);

  const [provinceCode, setProvinceCode] = useState(initial?.provinceCode ?? "");
  const [cityCode, setCityCode] = useState(initial?.cityCode ?? "");
  const [schoolName, setSchoolName] = useState(initial?.schoolName ?? "");
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [visibility, setVisibility] = useState<RankVisibility>(initial?.visibility ?? "public");
  const [consent, setConsent] = useState(initial?.consent ?? false);
  // When pre-filling for an edit, the first province effect must NOT wipe the
  // pre-selected city (that effect clears city on user-driven province changes).
  const preserveCityRef = useRef(Boolean(initial?.cityCode));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/leaderboard/regions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { provinces?: Option[] } | null) => setProvinces(data?.provinces ?? []))
      .catch(() => setError("地区列表加载失败，请刷新重试。"));
  }, []);

  useEffect(() => {
    if (!provinceCode) {
      setCities([]);
      return;
    }
    if (preserveCityRef.current) {
      preserveCityRef.current = false;
    } else {
      setCityCode("");
    }
    void fetch(`/api/leaderboard/regions?provinceCode=${provinceCode}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { cities?: Option[] } | null) => setCities(data?.cities ?? []))
      .catch(() => setCities([]));
  }, [provinceCode]);

  useEffect(() => {
    if (!cityCode) {
      setCitySchools([]);
      return;
    }
    void fetch(`/api/leaderboard/schools?cityCode=${cityCode}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { schools?: { name: string }[] } | null) =>
        setCitySchools((data?.schools ?? []).map((s) => s.name)),
      )
      .catch(() => setCitySchools([]));
  }, [cityCode]);

  const canSubmit =
    provinceCode && cityCode && schoolName.trim().length >= 2 && alias.trim().length >= 2 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/leaderboard/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provinceCode, cityCode, schoolName, alias, visibility, consent }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.message ?? "保存失败，请稍后再试。");
        return;
      }
      onComplete();
    } catch {
      setError("网络异常，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-border bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-brand" />
        <h2 className="text-base font-semibold text-fg-default">{editing ? "编辑档案与隐私设置" : "建立学习榜档案"}</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        填写你的学校与所在地区，用来把学习记录放进合适的校内、同城或全国复盘区间。信息为必填，仅用于学习榜分组。
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">省份 / 直辖市 *</span>
          <select
            value={provinceCode}
            onChange={(e) => setProvinceCode(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-bg-muted px-3 py-2 text-sm text-fg-default outline-none focus:border-brand"
          >
            <option value="">请选择</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-fg-muted">城市 *</span>
          <select
            value={cityCode}
            onChange={(e) => setCityCode(e.target.value)}
            disabled={!provinceCode}
            className="mt-1 w-full rounded-xl border border-border bg-bg-muted px-3 py-2 text-sm text-fg-default outline-none focus:border-brand disabled:opacity-50"
          >
            <option value="">{provinceCode ? "请选择" : "请先选择省份"}</option>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="flex items-center gap-1 text-xs font-medium text-fg-muted">
            <School2 className="h-3.5 w-3.5" /> 学校全称 *
          </span>
          <input
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            list="rank-school-suggestions"
            aria-label="学校全称"
            placeholder="例如：成都市第七中学"
            maxLength={40}
            className="mt-1 w-full rounded-xl border border-border bg-bg-muted px-3 py-2 text-sm text-fg-default outline-none focus:border-brand"
          />
          <datalist id="rank-school-suggestions">
            {citySchools.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {citySchools.length > 0 ? (
            <span className="mt-1 block text-xs text-fg-muted">
              已有 {citySchools.length} 所同城学校，输入时可从下拉中选择已有学校以便归类。
            </span>
          ) : null}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-fg-muted">榜单昵称 *（不展示真实姓名）</span>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            aria-label="榜单昵称"
            placeholder="例如：稳健小能手"
            maxLength={20}
            className="mt-1 w-full rounded-xl border border-border bg-bg-muted px-3 py-2 text-sm text-fg-default outline-none focus:border-brand"
          />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-medium text-fg-muted">谁可以看到我</legend>
        {/* itest6 R3 P3：隐私可见性是单选，此前选中态仅靠颜色（无 role=radio/aria-checked），
            屏幕阅读器/色觉障碍用户在加入榜单前无法确认选的是「隐身」还是「公开」。补 radiogroup 语义。 */}
        <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="谁可以看到我">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={visibility === opt.value}
              onClick={() => setVisibility(opt.value)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                visibility === opt.value
                  ? "border-brand bg-brand-subtle text-brand-ink"
                  : "border-border bg-bg-muted text-fg-default hover:border-brand/40"
              }`}
            >
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-fg-muted">{opt.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 flex items-start gap-2 rounded-xl bg-bg-muted px-3 py-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          aria-label="同意公开昵称与学习点进入学习榜"
          className="mt-0.5 h-4 w-4 accent-brand"
        />
        <span className="flex items-center gap-1 text-xs leading-5 text-fg-muted">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" />
          我已获得家长 / 监护人同意，公开我的昵称与学习点进入学习榜。未勾选也可保存信息，但暂不进入公开榜单。
        </span>
      </label>

      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {editing ? "保存修改" : consent ? "保存学习榜设置" : "保存信息"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-bg-muted px-4 py-2.5 text-sm font-semibold text-fg-default transition hover:border-brand/40 disabled:opacity-50 sm:w-auto"
          >
            取消
          </button>
        ) : null}
      </div>
    </section>
  );
}
