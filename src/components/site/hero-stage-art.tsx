export function HeroStageArt({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="absolute inset-0 rounded-[2.5rem] bg-[radial-gradient(circle_at_20%_20%,rgba(240,138,56,0.24),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.12),transparent_16%),linear-gradient(135deg,#0f1524_0%,#182238_55%,#0f1727_100%)]" />
      <div className="absolute inset-6 rounded-[2.2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,transparent_44%,rgba(255,255,255,0.04)_44.5%,transparent_45%,transparent_100%)] opacity-70" />
      <div className="absolute left-[10%] top-[22%] h-20 w-20 rounded-3xl border border-[#ffb67a]/35 bg-[#f08a3824] shadow-[0_22px_40px_rgba(240,138,56,0.18)]" />
      <div className="absolute left-[18%] top-[58%] h-16 w-16 rounded-2xl border border-white/18 bg-white/6 backdrop-blur-md" />
      <div className="absolute right-[14%] top-[18%] h-16 w-16 rounded-2xl border border-white/18 bg-white/6 backdrop-blur-md" />
      <div className="absolute right-[18%] top-[56%] h-20 w-20 rounded-[2rem] border border-[#ffb67a]/28 bg-[#f08a3818]" />

      <div className="absolute bottom-10 left-[26%] h-24 w-[52%] rounded-[2rem] border border-white/10 bg-[#0f1727] shadow-[0_30px_60px_rgba(0,0,0,0.35)]" />
      <div className="absolute bottom-[6.25rem] left-[34%] h-24 w-[36%] rounded-[1.8rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_30px_60px_rgba(0,0,0,0.3)]" />
      <div className="absolute bottom-[7rem] left-[38%] h-20 w-[28%] rounded-[1.5rem] border border-[#ffb67a]/20 bg-[linear-gradient(180deg,rgba(240,138,56,0.45),rgba(240,138,56,0.18))] shadow-[0_22px_44px_rgba(240,138,56,0.28)]" />
      <div className="absolute bottom-[12rem] left-[41%] h-7 w-[22%] rounded-2xl bg-[#f4efe8] shadow-[0_10px_24px_rgba(255,255,255,0.2)]" />
      <div className="absolute bottom-[13.5rem] left-[43%] h-28 w-[20%] rounded-[1.5rem] border border-white/18 bg-[linear-gradient(160deg,#ffffff_0%,#efe8df_72%,#d57f44_72%,#d57f44_100%)] shadow-[0_32px_70px_rgba(18,23,39,0.34)]">
        <div className="absolute left-0 top-0 h-full w-full rounded-[1.5rem] bg-[linear-gradient(90deg,transparent_0%,transparent_58%,rgba(240,138,56,0.18)_58%,rgba(240,138,56,0.18)_70%,transparent_70%)]" />
        <div className="absolute left-[12%] top-[16%] h-[3px] w-[56%] rounded-full bg-[#f08a38]" />
        <div className="absolute left-[12%] top-[32%] h-[3px] w-[68%] rounded-full bg-[#e7e1d8]" />
        <div className="absolute left-[12%] top-[48%] h-[3px] w-[64%] rounded-full bg-[#e7e1d8]" />
      </div>
      <svg
        className="absolute bottom-[16rem] left-[44%] w-[18%]"
        viewBox="0 0 160 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M4 42C28 12 52 12 76 42C100 72 124 72 156 18" stroke="#f08a38" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
