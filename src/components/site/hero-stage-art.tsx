import Image from "next/image";

export function HeroStageArt({ className }: { className?: string }) {
  return (
    <div className={["relative h-full w-full overflow-hidden rounded-[2.5rem] bg-[#0b1020]", className].filter(Boolean).join(" ")}>
      <Image
        src="/brand/hero-stage.svg"
        alt="Brown Zone AI 经济沙盘课堂决策场景"
        fill
        priority
        sizes="(max-width: 768px) 100vw, 50vw"
        className="p-2 object-contain sm:p-3"
      />
      <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] bg-[linear-gradient(115deg,transparent_0%,transparent_46%,rgba(255,255,255,0.08)_47%,transparent_48%,transparent_100%)]" />
    </div>
  );
}
