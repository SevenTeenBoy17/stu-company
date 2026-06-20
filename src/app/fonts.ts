import localFont from "next/font/local";

/**
 * Self-hosted brand fonts via `next/font/local` (no build-time network fetch).
 *
 * woff2 source files live in `./fonts/` and were copied from the OFL-licensed
 * @fontsource packages (Inter, Noto Sans SC, JetBrains Mono) — see devDependencies.
 * Each font exposes a CSS variable that `globals.css` consumes through the
 * `--font-sans` / `--font-display` / `--font-mono` token stacks.
 */

// Inter — Latin UI / headings / numerals (highest-value weights only).
export const inter = localFont({
  src: [
    {
      path: "./fonts/inter-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/inter-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/inter-latin-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

// Noto Sans SC — Simplified Chinese body + display (consolidated CJK subset).
export const notoSansSC = localFont({
  src: [
    {
      path: "./fonts/noto-sans-sc-chinese-simplified-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/noto-sans-sc-chinese-simplified-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-noto-sans-sc",
  display: "swap",
  fallback: ["PingFang SC", "Microsoft YaHei UI", "sans-serif"],
});

// JetBrains Mono — Latin monospace for code / fixed numerals.
export const jetbrainsMono = localFont({
  src: [
    {
      path: "./fonts/jetbrains-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/jetbrains-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
  fallback: ["Consolas", "monospace"],
});
