import type { ModuleKey } from "@/lib/types";

/**
 * Rich, original flat-vector illustrations for the homepage 投资课程 cards — one
 * themed financial scene per module. Built from a small set of reusable
 * primitives (coin, coin stack, candlestick, shadow) so all eight stay visually
 * consistent: brand amber + ink, soft ground shadows, and the project's red=up /
 * green=down candle convention. Decorative (the card title carries the meaning),
 * so the root <svg> is aria-hidden.
 */

const C = {
  amber: "#f08a38",
  amberDark: "#d96f1d",
  amber200: "#ffd49a",
  ink: "#233247",
  inkSoft: "#5b6b85",
  line: "#d4dceb",
  paper: "#ffffff",
  panel: "#f7faff",
  up: "#e8412e", // red = up
  down: "#16a14e", // green = down
  teal: "#27b3a3",
  blue: "#5b8def",
};

const SHADOW = "rgba(35,50,71,0.10)";

function Shadow({ cx = 160, cy = 198, rx = 92, ry = 11 }: { cx?: number; cy?: number; rx?: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={SHADOW} />;
}

function Coin({ cx, cy, r = 13, mark }: { cx: number; cy: number; r?: number; mark?: string }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + r * 0.9} rx={r * 0.9} ry={r * 0.26} fill="rgba(35,50,71,0.08)" />
      <circle cx={cx} cy={cy} r={r} fill={C.amberDark} />
      <circle cx={cx} cy={cy} r={r - 2.3} fill="#f6b73c" />
      <circle cx={cx} cy={cy} r={r - 5} fill="none" stroke="#ffd98a" strokeWidth={1.4} />
      {mark ? (
        <text
          x={cx}
          y={cy + r * 0.36}
          textAnchor="middle"
          fontSize={r}
          fontWeight={800}
          fill="#a8620f"
          fontFamily="system-ui, sans-serif"
        >
          {mark}
        </text>
      ) : (
        <path
          d={`M${cx - r * 0.32} ${cy - r * 0.24}A${r * 0.42} ${r * 0.42} 0 0 1 ${cx + r * 0.34} ${cy - r * 0.18}`}
          stroke="#fff"
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.7}
          fill="none"
        />
      )}
    </g>
  );
}

function CoinStack({ x, y, count = 3 }: { x: number; y: number; count?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 8} rx={17} ry={4.5} fill={SHADOW} />
      {Array.from({ length: count }).map((_, i) => {
        const cy = y - i * 7;
        return (
          <g key={i}>
            <rect x={x - 15} y={cy - 5} width={30} height={10} rx={5} fill={C.amberDark} />
            <ellipse cx={x} cy={cy - 5} rx={15} ry={5} fill="#f6b73c" />
            <ellipse cx={x} cy={cy - 6} rx={10.5} ry={3.3} fill="#ffd98a" />
          </g>
        );
      })}
    </g>
  );
}

function Candle({
  x,
  w = 11,
  top,
  bottom,
  wickTop,
  wickBottom,
  up,
}: {
  x: number;
  w?: number;
  top: number;
  bottom: number;
  wickTop: number;
  wickBottom: number;
  up: boolean;
}) {
  const color = up ? C.up : C.down;
  const cx = x + w / 2;
  return (
    <g>
      <line x1={cx} y1={wickTop} x2={cx} y2={wickBottom} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <rect x={x} y={top} width={w} height={Math.max(bottom - top, 3)} rx={2.4} fill={color} />
    </g>
  );
}

function Scene({ moduleKey }: { moduleKey: ModuleKey }) {
  switch (moduleKey) {
    /* ── 股市交易仿真 — candlestick monitor + coins ── */
    case "equities":
      return (
        <g>
          <rect x="78" y="50" width="156" height="106" rx="14" fill={C.paper} stroke={C.line} strokeWidth="3" />
          <rect x="88" y="62" width="136" height="74" rx="8" fill={C.panel} stroke={C.line} strokeWidth="2" />
          <line x1="96" y1="128" x2="216" y2="128" stroke={C.line} strokeWidth="2" />
          <Candle x={100} top={106} bottom={124} wickTop={100} wickBottom={128} up={false} />
          <Candle x={120} top={92} bottom={112} wickTop={84} wickBottom={118} up />
          <Candle x={140} top={98} bottom={114} wickTop={92} wickBottom={120} up={false} />
          <Candle x={160} top={84} bottom={106} wickTop={78} wickBottom={112} up />
          <Candle x={180} top={76} bottom={98} wickTop={70} wickBottom={104} up />
          <Candle x={200} top={70} bottom={90} wickTop={64} wickBottom={96} up />
          <path
            d="M105 118L125 100L145 106L165 92L185 82L205 74"
            stroke={C.amber}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="208" cy="70" r="3.6" fill={C.amber} />
          <rect x="149" y="156" width="14" height="14" fill={C.inkSoft} />
          <rect x="128" y="168" width="56" height="8" rx="4" fill={C.ink} />
          <CoinStack x={70} y={170} count={3} />
          <Coin cx={64} cy={146} r={13} mark="¥" />
          <Shadow />
        </g>
      );

    /* ── 多元投资组合 — donut allocation + asset chips ── */
    case "portfolio": {
      const circ = 175.93;
      const seg = (pct: number) => `${(pct * circ).toFixed(1)} ${(circ - pct * circ).toFixed(1)}`;
      return (
        <g>
          <Shadow cx={150} rx={86} />
          <g transform="rotate(-90 150 102)">
            <circle cx="150" cy="102" r="28" fill="none" stroke="#e6ecf6" strokeWidth="16" />
            <circle cx="150" cy="102" r="28" fill="none" stroke={C.amber} strokeWidth="16" strokeDasharray={seg(0.35)} />
            <circle cx="150" cy="102" r="28" fill="none" stroke={C.teal} strokeWidth="16" strokeDasharray={seg(0.25)} strokeDashoffset="-61.6" />
            <circle cx="150" cy="102" r="28" fill="none" stroke={C.blue} strokeWidth="16" strokeDasharray={seg(0.25)} strokeDashoffset="-105.6" />
            <circle cx="150" cy="102" r="28" fill="none" stroke={C.down} strokeWidth="16" strokeDasharray={seg(0.15)} strokeDashoffset="-149.6" />
          </g>
          <circle cx="150" cy="102" r="13" fill={C.paper} stroke={C.line} strokeWidth="2" />
          <text x="150" y="107" textAnchor="middle" fontSize="13" fontWeight="800" fill={C.amberDark} fontFamily="system-ui, sans-serif">¥</text>
          <rect x="206" y="58" width="44" height="26" rx="7" fill={C.paper} stroke={C.line} strokeWidth="2" />
          <text x="228" y="75" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.blue} fontFamily="system-ui, sans-serif">ETF</text>
          <rect x="214" y="94" width="40" height="24" rx="7" fill={C.paper} stroke={C.line} strokeWidth="2" />
          <text x="234" y="110" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.teal} fontFamily="system-ui, sans-serif">债</text>
          <rect x="206" y="128" width="44" height="24" rx="7" fill={C.paper} stroke={C.line} strokeWidth="2" />
          <text x="228" y="144" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.amberDark} fontFamily="system-ui, sans-serif">商品</text>
          <CoinStack x={78} y={172} count={3} />
        </g>
      );
    }

    /* ── 银行与储蓄 — piggy bank + coin drop + savings ── */
    case "banking":
      return (
        <g>
          <Shadow cx={150} rx={88} />
          <path d="M214 150C226 132 232 116 236 92" stroke={C.amber200} strokeWidth="6" fill="none" strokeLinecap="round" />
          <ellipse cx="150" cy="120" rx="58" ry="44" fill={C.amber} />
          <ellipse cx="150" cy="120" rx="58" ry="44" fill="#ffffff" opacity="0.12" />
          <path d="M118 84L132 76L130 98Z" fill={C.amberDark} />
          <ellipse cx="100" cy="124" rx="18" ry="20" fill="#ffb066" />
          <circle cx="95" cy="120" r="3" fill={C.amberDark} />
          <circle cx="105" cy="124" r="3" fill={C.amberDark} />
          <circle cx="128" cy="108" r="4.5" fill={C.ink} />
          <rect x="116" y="158" width="14" height="14" rx="4" fill={C.amberDark} />
          <rect x="172" y="158" width="14" height="14" rx="4" fill={C.amberDark} />
          <rect x="142" y="84" width="26" height="6" rx="3" fill={C.amberDark} />
          <Coin cx={155} cy={62} r={12} mark="¥" />
          <CoinStack x={226} y={172} count={2} />
        </g>
      );

    /* ── 房地产模拟 — house + price tag + coins ── */
    case "property":
      return (
        <g>
          <Shadow cx={150} rx={90} />
          <rect x="98" y="108" width="104" height="64" rx="8" fill={C.paper} stroke={C.line} strokeWidth="3" />
          <path d="M88 112L150 64L212 112Z" fill={C.amber} stroke={C.amberDark} strokeWidth="3" strokeLinejoin="round" />
          <rect x="180" y="74" width="14" height="24" rx="3" fill={C.amberDark} />
          <rect x="138" y="132" width="26" height="40" rx="5" fill={C.amber200} stroke={C.amberDark} strokeWidth="2.5" />
          <circle cx="158" cy="152" r="2.4" fill={C.amberDark} />
          <rect x="110" y="124" width="20" height="18" rx="4" fill={C.panel} stroke={C.line} strokeWidth="2.5" />
          <rect x="172" y="124" width="20" height="18" rx="4" fill={C.panel} stroke={C.line} strokeWidth="2.5" />
          <g transform="rotate(12 214 86)">
            <rect x="196" y="74" width="40" height="26" rx="6" fill={C.down} />
            <circle cx="202" cy="80" r="3" fill="#ffffff" />
            <text x="218" y="92" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">$</text>
          </g>
          <CoinStack x={78} y={172} count={3} />
        </g>
      );

    /* ── 创业与并购 — rocket + growth bars ── */
    case "venture":
      return (
        <g>
          <Shadow cx={150} rx={90} />
          <rect x="96" y="138" width="20" height="32" rx="5" fill={C.amber200} />
          <rect x="124" y="118" width="20" height="52" rx="5" fill={C.amber} />
          <rect x="152" y="96" width="20" height="74" rx="5" fill={C.amberDark} />
          <g transform="rotate(20 210 92)">
            <path d="M210 56C228 64 230 92 222 112L198 112C190 92 192 64 210 56Z" fill={C.paper} stroke={C.line} strokeWidth="3" />
            <circle cx="210" cy="84" r="8" fill={C.blue} />
            <path d="M198 104L186 120L202 112Z" fill={C.amber} />
            <path d="M222 104L234 120L218 112Z" fill={C.amber} />
            <path d="M204 116L210 134L216 116Z" fill={C.up} />
          </g>
          <Coin cx={80} cy={150} r={13} mark="¥" />
          <CoinStack x={184} y={172} count={2} />
        </g>
      );

    /* ── 突发事件卡 — alert card + volatile line ── */
    case "events":
      return (
        <g>
          <Shadow />
          <rect x="74" y="58" width="172" height="104" rx="14" fill={C.paper} stroke={C.line} strokeWidth="3" />
          <line x1="86" y1="130" x2="234" y2="130" stroke={C.line} strokeWidth="2" />
          <path
            d="M88 96L108 88L124 150L142 104L160 132L182 84L204 112L232 78"
            stroke={C.up}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M204 112L232 78" stroke={C.down} strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <circle cx="220" cy="70" r="16" fill="#fff2d8" stroke={C.amber} strokeWidth="3" />
          <rect x="218" y="62" width="4" height="11" rx="2" fill={C.amberDark} />
          <circle cx="220" cy="78" r="2.4" fill={C.amberDark} />
          <CoinStack x={62} y={170} count={2} />
        </g>
      );

    /* ── 社区与竞赛 — trophy + podium ── */
    case "competition":
      return (
        <g>
          <Shadow cx={150} rx={90} />
          <rect x="108" y="138" width="36" height="34" rx="4" fill={C.amber200} />
          <rect x="144" y="116" width="36" height="56" rx="4" fill={C.amber} />
          <rect x="180" y="150" width="36" height="22" rx="4" fill="#ffe7c6" />
          <text x="126" y="160" textAnchor="middle" fontSize="13" fontWeight="800" fill={C.amberDark} fontFamily="system-ui, sans-serif">2</text>
          <text x="162" y="148" textAnchor="middle" fontSize="15" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">1</text>
          <text x="198" y="166" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.amberDark} fontFamily="system-ui, sans-serif">3</text>
          <path d="M146 60H178V74C178 90 170 98 162 98C154 98 146 90 146 60Z" fill="#f6b73c" stroke={C.amberDark} strokeWidth="3" strokeLinejoin="round" />
          <path d="M146 64C136 64 134 78 146 80" stroke={C.amberDark} strokeWidth="3" fill="none" />
          <path d="M178 64C188 64 190 78 178 80" stroke={C.amberDark} strokeWidth="3" fill="none" />
          <rect x="158" y="98" width="8" height="10" fill={C.amberDark} />
          <rect x="148" y="108" width="28" height="8" rx="4" fill={C.ink} />
          <path d="M156 74L160 80L168 70" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Coin cx={80} cy={150} r={12} />
        </g>
      );

    /* ── 教师与家长端 — dual dashboards + growth ── */
    case "guardian":
      return (
        <g>
          <Shadow />
          <rect x="70" y="62" width="116" height="96" rx="12" fill={C.paper} stroke={C.line} strokeWidth="3" />
          <rect x="80" y="74" width="96" height="10" rx="5" fill={C.panel} />
          <rect x="80" y="92" width="60" height="8" rx="4" fill="#e6ecf6" />
          <rect x="82" y="128" width="12" height="18" rx="3" fill={C.amber200} />
          <rect x="100" y="118" width="12" height="28" rx="3" fill={C.amber} />
          <rect x="118" y="124" width="12" height="22" rx="3" fill={C.teal} />
          <rect x="136" y="110" width="12" height="36" rx="3" fill={C.amberDark} />
          <rect x="196" y="78" width="56" height="92" rx="12" fill={C.paper} stroke={C.line} strokeWidth="3" />
          <rect x="206" y="90" width="36" height="8" rx="4" fill={C.panel} />
          <path d="M206 146C214 130 224 124 242 116" stroke={C.amber} strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <circle cx="242" cy="116" r="4" fill={C.amber} />
          <path d="M224 126C222 122 216 122 216 127C216 132 224 137 224 137C224 137 232 132 232 127C232 122 226 122 224 126Z" fill={C.up} />
        </g>
      );

    default:
      return <Shadow />;
  }
}

export function ModuleIllustration({
  moduleKey,
  className,
}: {
  moduleKey: ModuleKey;
  className?: string;
}) {
  const bgId = `bz-illu-bg-${moduleKey}`;
  return (
    <svg
      viewBox="0 0 320 220"
      className={className}
      fill="none"
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="320" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff8ee" />
          <stop offset="1" stopColor="#eef3fb" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="308" height="208" rx="26" fill={`url(#${bgId})`} />
      <circle cx="238" cy="50" r="40" fill="#ffffff" opacity="0.5" />
      <circle cx="74" cy="176" r="30" fill="#ffffff" opacity="0.45" />
      <Scene moduleKey={moduleKey} />
    </svg>
  );
}
