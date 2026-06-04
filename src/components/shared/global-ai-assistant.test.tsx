import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { axe } from "vitest-axe";

import { getStarterPrompts, resolveAiChatMode } from "@/lib/assistant-config";

import { AI_CHAT_ENDPOINT } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { GlobalAiAssistant } from "./global-ai-assistant";

// No Next runtime in vitest — stub the router hook the component depends on.
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

// Drives the component as a GUEST (viewer = null): no mount-time history fetch, so
// every network interaction below is the explicit POST /api/ai/chat under test.
// MSW (global lifecycle in src/test/setup.ts) lets each test inject success /
// failure / delay / empty / adversarial responses for that one boundary.

const guestStarters = getStarterPrompts(resolveAiChatMode("/", undefined), undefined);

async function openPanel() {
  const user = userEvent.setup();
  render(<GlobalAiAssistant viewer={null} />);
  await user.click(screen.getByRole("button", { name: "打开 KeyAI" }));
  await screen.findByRole("button", { name: "发送消息" });
  return user;
}

describe("GlobalAiAssistant (guest)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the launcher and keeps the panel closed initially", () => {
    render(<GlobalAiAssistant viewer={null} />);
    // ground truth: the floating trigger is always present; the dialog is not.
    expect(screen.getByRole("button", { name: "打开 KeyAI" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "发送消息" })).toBeNull();
  });

  it("on login, wipes a previous student's lingering AI storage (P1 — shared-computer privacy)", async () => {
    // Seed a previous student's auth-mirror + a guest cache + this user's own cache.
    window.sessionStorage.setItem("brown-zone-ai-auth-cache:prev-student", JSON.stringify([{ id: "x" }]));
    window.localStorage.setItem("brown-zone-ai-guest-sessions", JSON.stringify([{ id: "g" }]));
    window.sessionStorage.setItem("brown-zone-ai-auth-cache:me", JSON.stringify([{ id: "mine" }]));

    render(<GlobalAiAssistant viewer={{ id: "me", role: "student", name: "我" }} />);

    // The login effect runs clearBrownZoneAiStorage("me"): foreign + guest wiped, own kept.
    await waitFor(() =>
      expect(window.sessionStorage.getItem("brown-zone-ai-auth-cache:prev-student")).toBeNull(),
    );
    expect(window.localStorage.getItem("brown-zone-ai-guest-sessions")).toBeNull();
    expect(window.sessionStorage.getItem("brown-zone-ai-auth-cache:me")).not.toBeNull();
  });

  it("opens the chat panel when the launcher is clicked", async () => {
    const user = userEvent.setup();
    render(<GlobalAiAssistant viewer={null} />);
    await user.click(screen.getByRole("button", { name: "打开 KeyAI" }));
    // ground truth: clicking the launcher mounts the panel (send affordance appears).
    expect(await screen.findByRole("button", { name: "发送消息" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/问我任何问题/)).toBeInTheDocument();
  });

  it("sends a prompt and renders the assistant reply (remote success)", async () => {
    server.use(
      http.post(AI_CHAT_ENDPOINT, () =>
        HttpResponse.json({ reply: "云端给出的建议。", provider: "remote", sessionId: "s1" }),
      ),
    );
    const user = await openPanel();
    await user.type(screen.getByPlaceholderText(/问我任何问题/), "帮我看看仓位");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    // ground truth: optimistic user bubble + assistant reply + remote status note.
    expect(await screen.findByText("云端给出的建议。")).toBeInTheDocument();
    expect(screen.getByText("帮我看看仓位")).toBeInTheDocument();
    expect(screen.getByText(/云端分析/)).toBeInTheDocument();
  });

  it("renders the user message before the assistant reply (real-time ordering)", async () => {
    // No SSE here — the real-time surface is fetch-then-state-update. This pins the
    // message ORDER that a streaming UI would also have to guarantee.
    server.use(
      http.post(AI_CHAT_ENDPOINT, () => HttpResponse.json({ reply: "助手回复内容。", provider: "remote" })),
    );
    const user = await openPanel();
    await user.type(screen.getByPlaceholderText(/问我任何问题/), "我的提问");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    const reply = await screen.findByText("助手回复内容。");
    const question = screen.getByText("我的提问");
    // The user bubble must precede the assistant bubble in the DOM.
    expect(question.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("flags a local fallback reply with the conservative status note", async () => {
    server.use(
      http.post(AI_CHAT_ENDPOINT, () =>
        HttpResponse.json({ reply: "本地兜底回答。", provider: "fallback" }),
      ),
    );
    const user = await openPanel();
    await user.type(screen.getByPlaceholderText(/问我任何问题/), "你好");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    // ground truth: provider==="fallback" -> conservative note (sendPrompt:310-314).
    expect(await screen.findByText("本地兜底回答。")).toBeInTheDocument();
    expect(screen.getByText(/本地教学兜底/)).toBeInTheDocument();
  });

  it("surfaces an error (no crash) when the API returns 500", async () => {
    server.use(
      http.post(AI_CHAT_ENDPOINT, () =>
        HttpResponse.json({ error: "KeyAI 暂时不可用。" }, { status: 500 }),
      ),
    );
    const user = await openPanel();
    await user.type(screen.getByPlaceholderText(/问我任何问题/), "崩一个");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    // ground truth: !response.ok -> throw -> catch sets error + retry status note.
    expect(await screen.findByText("KeyAI 暂时不可用。")).toBeInTheDocument();
    expect(screen.getByText(/没有成功完成/)).toBeInTheDocument();
  });

  it("treats an empty reply as a failure (adversarial empty body)", async () => {
    server.use(http.post(AI_CHAT_ENDPOINT, () => HttpResponse.json({ reply: "", provider: "remote" })));
    const user = await openPanel();
    await user.type(screen.getByPlaceholderText(/问我任何问题/), "空回复");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    // ground truth: !payload.reply -> treated as failure (sendPrompt:289).
    expect(await screen.findByText(/没有成功完成/)).toBeInTheDocument();
  });

  it("disables the send button while a slow request is in flight", async () => {
    server.use(
      http.post(AI_CHAT_ENDPOINT, async () => {
        await delay(60);
        return HttpResponse.json({ reply: "延迟后的回答。", provider: "remote" });
      }),
    );
    const user = await openPanel();
    await user.type(screen.getByPlaceholderText(/问我任何问题/), "等一下");
    const send = screen.getByRole("button", { name: "发送消息" });
    await user.click(send);

    // ground truth: isSending disables the button mid-flight, re-enables after reply.
    expect(send).toBeDisabled();
    expect(await screen.findByText("延迟后的回答。")).toBeInTheDocument();
    expect(send).not.toBeDisabled();
  });

  it("sends a starter prompt when its quick-action button is clicked", async () => {
    // Fail loudly (don't silently skip) if guest mode ever stops offering starters.
    expect(guestStarters.length).toBeGreaterThan(0);
    server.use(
      http.post(AI_CHAT_ENDPOINT, async ({ request }) => {
        const body = (await request.json()) as { prompt: string };
        return HttpResponse.json({ reply: `回答：${body.prompt}`, provider: "remote" });
      }),
    );
    const user = await openPanel();
    await user.click(await screen.findByRole("button", { name: guestStarters[0] }));
    expect(await screen.findByText(`回答：${guestStarters[0]}`)).toBeInTheDocument();
  });

  it("has no axe-core violations when the panel is open", async () => {
    const user = userEvent.setup();
    const { container } = render(<GlobalAiAssistant viewer={null} />);
    await user.click(screen.getByRole("button", { name: "打开 KeyAI" }));
    await screen.findByRole("button", { name: "发送消息" });

    const results = await axe(container, {
      rules: {
        // Isolated component, not a full page: skip document-scoped best practices.
        region: { enabled: false },
        "page-has-heading-one": { enabled: false },
        // jsdom has no canvas, so axe cannot compute rendered colors — skip contrast.
        "color-contrast": { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});
