import type { ModuleKey } from "@/lib/types";

const accents = {
  primary: "#f08a38",
  soft: "#ffe0be",
  dark: "#141b2d",
  line: "#31405f",
  mint: "#78d6bf",
};

export function ModuleIllustration({
  moduleKey,
  className,
}: {
  moduleKey: ModuleKey;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 320 220"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="304" height="204" rx="28" fill="#f9fafc" />
      <ellipse cx="160" cy="192" rx="74" ry="10" fill="#d5dae6" />
      {moduleKey === "equities" && (
        <>
          <rect x="78" y="70" width="164" height="96" rx="18" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <path d="M98 144L130 122L152 138L186 96L222 118" stroke={accents.primary} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M110 88V150M144 80V150M176 100V150M210 92V150" stroke="#cfd6e6" strokeWidth="3" />
          <circle cx="245" cy="136" r="18" fill={accents.soft} stroke={accents.primary} strokeWidth="4" />
          <path d="M238 140L244 132L252 137" stroke={accents.dark} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {moduleKey === "portfolio" && (
        <>
          <rect x="88" y="58" width="144" height="104" rx="18" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <path d="M108 142V118H132V142" fill={accents.soft} stroke={accents.primary} strokeWidth="4" />
          <path d="M144 142V100H168V142" fill="#fde8cf" stroke={accents.primary} strokeWidth="4" />
          <path d="M180 142V84H204V142" fill="#fff1df" stroke={accents.primary} strokeWidth="4" />
          <circle cx="230" cy="84" r="22" fill="#e8eef8" stroke={accents.line} strokeWidth="4" />
          <path d="M230 84L245 74" stroke={accents.primary} strokeWidth="4" strokeLinecap="round" />
          <path d="M230 84V62" stroke={accents.line} strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {moduleKey === "banking" && (
        <>
          <rect x="106" y="62" width="108" height="102" rx="20" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <rect x="122" y="84" width="76" height="20" rx="10" fill={accents.soft} />
          <rect x="122" y="116" width="76" height="16" rx="8" fill="#e8eef8" />
          <rect x="122" y="140" width="48" height="10" rx="5" fill="#d7deea" />
          <circle cx="232" cy="142" r="18" fill="#ffe9c9" stroke={accents.primary} strokeWidth="4" />
          <path d="M232 132V152M226 138H236" stroke={accents.dark} strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {moduleKey === "property" && (
        <>
          <path d="M88 150L160 90L232 150V166H88V150Z" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <path d="M104 146V114L160 72L216 114V146" fill="#eef2f9" stroke={accents.line} strokeWidth="4" />
          <rect x="142" y="128" width="36" height="38" rx="8" fill={accents.soft} stroke={accents.primary} strokeWidth="4" />
          <rect x="108" y="126" width="24" height="22" rx="6" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <rect x="188" y="126" width="24" height="22" rx="6" fill="#fff" stroke={accents.line} strokeWidth="4" />
        </>
      )}
      {moduleKey === "venture" && (
        <>
          <rect x="76" y="80" width="168" height="92" rx="20" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <path d="M100 150L132 118L156 132L184 96L218 106" stroke={accents.primary} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M220 82L236 98L220 114" stroke={accents.mint} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="102" cy="96" r="18" fill={accents.soft} stroke={accents.primary} strokeWidth="4" />
          <path d="M96 96H108M102 90V102" stroke={accents.dark} strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {moduleKey === "events" && (
        <>
          <path d="M96 168L130 100L162 132L194 74L230 168" fill="url(#eventFill)" stroke={accents.line} strokeWidth="4" />
          <circle cx="194" cy="74" r="20" fill="#fff2d8" stroke={accents.primary} strokeWidth="4" />
          <path d="M194 60V82M182 74H206" stroke={accents.dark} strokeWidth="3.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="eventFill" x1="96" y1="74" x2="230" y2="168" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFF3E4" />
              <stop offset="1" stopColor="#E7EEF8" />
            </linearGradient>
          </defs>
        </>
      )}
      {moduleKey === "competition" && (
        <>
          <rect x="84" y="78" width="154" height="88" rx="20" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <path d="M112 146H210" stroke="#d7deea" strokeWidth="4" strokeLinecap="round" />
          <path d="M118 138L146 116L174 126L208 96" stroke={accents.primary} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="92" cy="72" r="18" fill="#e8eef8" stroke={accents.line} strokeWidth="4" />
          <text x="92" y="78" textAnchor="middle" fontSize="18" fontWeight="700" fill="#141b2d">#1</text>
        </>
      )}
      {moduleKey === "guardian" && (
        <>
          <rect x="76" y="72" width="78" height="104" rx="18" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <rect x="166" y="58" width="78" height="118" rx="18" fill="#fff" stroke={accents.line} strokeWidth="4" />
          <path d="M92 100H138M92 122H126M92 144H118" stroke="#d7deea" strokeWidth="4" strokeLinecap="round" />
          <path d="M182 92H228M182 114H220" stroke="#d7deea" strokeWidth="4" strokeLinecap="round" />
          <path d="M182 146C194 130 208 124 228 120" stroke={accents.primary} strokeWidth="6" strokeLinecap="round" />
          <circle cx="228" cy="120" r="8" fill={accents.primary} />
        </>
      )}
      <circle cx="68" cy="158" r="14" fill="#ffe9c9" stroke={accents.primary} strokeWidth="4" />
      <path d="M62 158H74M68 152V164" stroke={accents.dark} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
