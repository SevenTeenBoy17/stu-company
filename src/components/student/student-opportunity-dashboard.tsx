"use client";

import { useRef, useState, useTransition } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Bot, CheckCircle2, ClipboardPenLine, Loader2, Radar, Sparkles } from "lucide-react";

import type { OpportunityPayload, OpportunityReason, OpportunityThemeId } from "@/lib/opportunity";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type MessageState = { tone: "success" | "error"; text: string } | null;

export function StudentOpportunityDashboard({ initialPayload }: { initialPayload: OpportunityPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [selectedCardId, setSelectedCardId] = useState<OpportunityThemeId>(initialPayload.cards[0]?.id ?? "ai-infra");
  const [reason, setReason] = useState<OpportunityReason>("learning");
  const [confidence, setConfidence] = useState(62);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<MessageState>(null);
  const [pending, startTransition] = useTransition();
  const selected = payload.cards.find((item) => item.id === selectedCardId) ?? payload.cards[0];
  const trimmedNote = note.trim();
  const noteReady = trimmedNote.length >= 8;

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-opportunity-item]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-opportunity-item]", {
        opacity: 0,
        y: 20,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.06,
      });
    },
    { scope: rootRef },
  );

  function submitNote() {
    if (!noteReady) {
      setMessage({ tone: "error", text: "请先写下至少 8 个字的观察说明，再记录观察单。" });
      return;
    }
    setMessage(null);
    startTransition(() => {
      void fetch("/api/student/opportunity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: selectedCardId, reason, confidence, note }),
      })
        .then(async (response) => {
          const data = (await response.json()) as {
            payload?: OpportunityPayload;
            message?: string;
            error?: string;
          };
          if (!response.ok || !data.payload) {
            throw new Error(data.message ?? "观察单提交失败，请稍后再试。");
          }
          setPayload(data.payload);
          setNote("");
          setMessage({ tone: "success", text: data.message ?? "观察单已记录。" });
        })
        .catch((error) => {
          setMessage({
            tone: "error",
            text: error instanceof Error ? error.message : "观察单提交失败，请稍后再试。",
          });
        });
    });
  }

  return (
    <div ref={rootRef} className="space-y-6 pb-24" data-testid="opportunity-dashboard">
      <section
        data-opportunity-item
        data-motion-reveal
        className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] md:p-8"
      >
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-300">Opportunity Lab</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
              机会训练场：先写观察单，再谈模拟配置
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/70">
              把热门板块、资金流和政策主题转成青少年能理解的训练任务。目标不是猜涨跌，而是练习证据链、风险意识和复盘表达。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["观察单", payload.overview.notesCount],
              ["观察力", payload.overview.observationScore],
              ["阶段", payload.overview.stageLabel],
            ].map(([label, value]) => (
              <div key={String(label)} data-motion-card className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4">
                <p className="text-sm font-bold text-white/70">{label}</p>
                <p className="mt-2 text-2xl font-black text-orange-200">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
        <section data-opportunity-item data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-orange-500" />
            <h2 className="text-2xl font-black text-slate-950">主题机会卡</h2>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {payload.cards.map((card) => {
              const active = card.id === selectedCardId;
              return (
                <button
                  data-motion-card
                  key={card.id}
                  type="button"
                  data-testid={`opportunity-card-${card.id}`}
                  onClick={() => setSelectedCardId(card.id)}
                  className={cn(
                    "rounded-[1.6rem] border p-5 text-left transition hover:-translate-y-1",
                    active
                      ? "border-orange-300 bg-orange-50 shadow-[0_18px_50px_rgba(251,146,60,0.16)]"
                      : "border-slate-200 bg-white hover:border-orange-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-black text-slate-950">{card.title}</p>
                      <p className="mt-1 text-sm font-bold text-slate-600">{card.category}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-orange-600">
                      热度 {card.heat}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{card.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {card.evidence.map((item) => (
                      <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {item}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside data-opportunity-item data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ClipboardPenLine className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-black text-slate-950">开一张观察单</h2>
            </div>
            <div className="mt-5 rounded-[1.4rem] bg-slate-50 p-4">
              <p className="text-lg font-black text-slate-950">{selected.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selected.concept}</p>
              <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-slate-600">
                思考题：{selected.watchQuestion}
              </p>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black text-slate-600">观察理由</span>
              <select
                data-testid="opportunity-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as OpportunityReason)}
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold outline-none focus:border-orange-400"
              >
                {payload.reasonOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-600">信心分 {confidence}</span>
              <input
                data-testid="opportunity-confidence"
                type="range"
                min={1}
                max={100}
                value={confidence}
                onChange={(event) => setConfidence(Number(event.target.value))}
                className="w-full accent-orange-500"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-600">我的观察说明</span>
              <textarea
                data-testid="opportunity-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                placeholder="例如：AI 算力需求还在增长，但估值和集中度较高，我下一回合要观察是否出现回撤。"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold leading-7 outline-none focus:border-orange-400"
              />
              <span
                className={cn(
                  "mt-1 block text-xs font-bold",
                  noteReady ? "text-emerald-600" : "text-slate-600",
                )}
              >
                {noteReady ? "可以记录啦 ✓" : `还需 ${8 - trimmedNote.length} 个字（至少写 8 个字）`}
              </span>
            </label>

            <button
              data-motion-button
              type="button"
              data-testid="opportunity-submit"
              disabled={pending || !noteReady}
              onClick={submitNote}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-orange-400 px-5 text-base font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              记录观察单
            </button>
            {message ? (
              <p
                role={message.tone === "success" ? "status" : "alert"}
                className={cn(
                  "mt-4 rounded-2xl px-4 py-3 text-sm font-bold",
                  message.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                )}
              >
                {message.text}
              </p>
            ) : null}
          </section>

          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-black text-slate-950">{payload.coach.title}</h2>
            </div>
            <p className="mt-4 text-base leading-8 text-slate-600">{payload.coach.summary}</p>
            <div className="mt-4 space-y-3">
              {payload.coach.nextSteps.map((step) => (
                <p key={step} data-motion-card className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-600">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  {step}
                </p>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section data-opportunity-item data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Observation History</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">我的机会观察记录</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
            最佳主题：{payload.overview.bestTheme}
          </span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3" data-testid="opportunity-history">
          {payload.notes.length > 0 ? (
            payload.notes.slice(0, 6).map((entry) => (
              <article key={entry.id} data-motion-card className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-lg font-black text-slate-950">{entry.title}</p>
                <p className="mt-1 text-sm font-bold text-orange-600">
                  观察力 {entry.score} · 信心 {entry.confidence} · {entry.reasonLabel}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{entry.note}</p>
                <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                  {entry.feedback}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-base font-semibold text-slate-600 lg:col-span-3">
              还没有观察单。先选一个主题，写下证据和风险，历史复盘就会多一条可讨论的线索。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
