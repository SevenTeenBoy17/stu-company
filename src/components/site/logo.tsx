import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_18px_40px_rgba(9,12,20,0.28)] backdrop-blur">
        <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(240,138,56,0.4),transparent_55%,rgba(255,255,255,0.18))]" />
        <div className="relative flex h-6 w-5 items-start justify-center rounded-[0.7rem] border border-white/80 bg-slate-100/95 pt-1 text-[0.65rem] font-black text-slate-900">
          B
        </div>
      </div>
      <div className="flex flex-col">
        <span className="font-display text-xl font-semibold tracking-tight text-white">
          Brown Zone
        </span>
        <span className="text-[0.68rem] uppercase tracking-[0.28em] text-white/45">
          Mr.Brown Sandbox
        </span>
      </div>
    </div>
  );
}
