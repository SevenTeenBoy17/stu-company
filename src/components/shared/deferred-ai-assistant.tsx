"use client";

import dynamic from "next/dynamic";

import type { Role } from "@/lib/types";

/**
 * PERF-BUNDLE-2: the global KeyAI assistant is a 700+ line client island (chat
 * panel, 8 icons, fetch/session logic). Nothing it renders is LCP content — only a
 * floating action button — so defer its whole bundle off every page's first-load
 * critical path and load it on the client after hydration (it still self-opens on
 * AI_ASSISTANT_OPEN_EVENT once loaded). `ssr: false` is permitted here because this
 * wrapper is a Client Component (the root layout is a Server Component, where it is
 * not).
 */
const GlobalAiAssistant = dynamic(
  () => import("@/components/shared/global-ai-assistant").then((mod) => mod.GlobalAiAssistant),
  { ssr: false },
);

type Viewer = { id: string; role: Role; name: string } | null;

export function DeferredAiAssistant({ viewer }: { viewer: Viewer }) {
  return <GlobalAiAssistant viewer={viewer} />;
}
