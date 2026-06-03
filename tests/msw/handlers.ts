import { http, HttpResponse } from "msw";

// Mock the OUTBOUND network boundary of the AI gateway (src/lib/ai.ts), which
// POSTs to `${base}/v1/messages` (Anthropic-style). We intercept at this gateway
// boundary — never a concrete provider SDK — per AGENTS.md (all AI egress flows
// through src/lib/ai.ts). Tests override per-case with `server.use(...)`.

/** Anthropic-style success body that ai.ts parses into `{ provider:"remote", text }`. */
export function aiMessage(text: string) {
  return HttpResponse.json({ content: [{ type: "text", text }] });
}

// Example base URLs used by the AI gateway tests, with their resolved endpoints.
export const AI_PRIMARY_BASE = "https://primary.example/v1";
export const AI_SECONDARY_BASE = "https://secondary.example";
export const AI_PRIMARY_ENDPOINT = "https://primary.example/v1/messages";
export const AI_SECONDARY_ENDPOINT = "https://secondary.example/v1/messages";

// Default: both base urls answer 200. Individual tests override via server.use().
export const handlers = [
  http.post(AI_PRIMARY_ENDPOINT, () => aiMessage("主地址 AI 建议")),
  http.post(AI_SECONDARY_ENDPOINT, () => aiMessage("第二地址 AI 建议")),
];
