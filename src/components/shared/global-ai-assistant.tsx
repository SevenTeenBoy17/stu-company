"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Image from "next/image";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { usePathname } from "next/navigation";
import {
  History,
  LoaderCircle,
  MessageSquareQuote,
  Plus,
  SendHorizontal,
  X,
} from "lucide-react";

import {
  AI_ASSISTANT_OPEN_EVENT,
  buildAiSessionTitle,
  getStarterPrompts,
  type AiAssistantLaunchDetail,
  resolveAiChatMode,
} from "@/lib/assistant-config";
import type { AiChatMessage, AiChatSession, Role } from "@/lib/types";
import { cn, formatDateLabel } from "@/lib/utils";

const GUEST_STORAGE_KEY = "brown-zone-ai-guest-sessions";

// B: 悬浮球周期性标语气泡的配置。营销性提醒，克制不骚扰——本会话打开过面板即静默。
const BUBBLE_DISMISSED_KEY = "brown-zone-ai-bubble-dismissed";
const BUBBLE_MESSAGES = [
  "这笔交易值不值？问我",
  "有问题？找 Mr.Brown",
  "AI 助手 · 点我提问",
] as const;
const BUBBLE_FIRST_DELAY_MS = 8_000; // 挂载后首次出现
const BUBBLE_VISIBLE_MS = 4_000; // 停留后自动收起
const BUBBLE_INTERVAL_MS = 60_000; // 之后每 60s 轮换出现
const BUBBLE_MAX_SHOWS = 3; // 最多出现 3 次

type Viewer = {
  id: string;
  role: Role;
  name: string;
} | null;

type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  mode: "guest" | "platform-generic" | "student-context";
};

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readGuestSessions() {
  if (typeof window === "undefined") return [] as AiChatSession[];

  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestSessions(sessions: AiChatSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(sessions.slice(0, 5)));
}

// H3: auth-mirror cache moves from localStorage to sessionStorage so a shared
// school computer drops the previous student's AI history when the tab/window
// closes. Logout-time cleanup also wipes any pre-existing localStorage caches.
function readAuthMirrorSessions(userId: string) {
  if (typeof window === "undefined") return [] as AiChatSession[];

  try {
    const raw = window.sessionStorage.getItem(`brown-zone-ai-auth-cache:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAuthMirrorSessions(userId: string, sessions: AiChatSession[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    `brown-zone-ai-auth-cache:${userId}`,
    JSON.stringify(sessions.slice(0, 10)),
  );
}

/**
 * Wipe AI-related browser storage. Pass `exceptUserId` to KEEP that user's own
 * auth-mirror cache and drop everyone else's — used on login so a shared school
 * computer never carries a previous student's AI history into the next session.
 * (There is no logout button in the app, so login-time cleanup is the guarantee.)
 */
export function clearBrownZoneAiStorage(exceptUserId?: string) {
  if (typeof window === "undefined") return;
  const keep = exceptUserId ? `brown-zone-ai-auth-cache:${exceptUserId}` : null;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith("brown-zone-ai-") && key !== keep) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  }
}

function upsertGuestSession(sessions: AiChatSession[], nextSession: AiChatSession) {
  return [nextSession, ...sessions.filter((session) => session.id !== nextSession.id)]
    .sort((left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt))
    .slice(0, 5);
}

function getLatestContextMeta(messages: AiChatMessage[]) {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user" && (message.meta?.assetId || message.meta?.actionLogId));

  return {
    assetId: latestUserMessage?.meta?.assetId,
    actionLogId: latestUserMessage?.meta?.actionLogId,
  };
}

function preferredScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

export function GlobalAiAssistant({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [guestSessions, setGuestSessions] = useState<AiChatSession[]>([]);
  const [historyEntries, setHistoryEntries] = useState<SessionSummary[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMeta, setContextMeta] = useState<{ assetId?: string; actionLogId?: string }>({});
  // B: 标语气泡的可见性与轮换文案序号。
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubbleIndex, setBubbleIndex] = useState(0);

  // A11y: full dialog keyboard contract — focus-in, Tab-trap, Esc, focus-restore.
  useFocusTrap(isOpen, panelRef, () => setIsOpen(false));
  const viewerKey = viewer?.id ?? "guest";

  const mode = useMemo(() => resolveAiChatMode(pathname, viewer?.role), [pathname, viewer?.role]);
  const starterPrompts = useMemo(() => getStarterPrompts(mode, viewer?.role), [mode, viewer?.role]);
  const sessionEntries = viewer
    ? historyEntries
    : guestSessions.map((session) => ({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        mode: session.mode,
      }));

  async function refreshAuthHistory() {
    if (!viewer) return;

    const response = await fetch("/api/ai/history", { cache: "no-store" });
    if (!response.ok) {
      const mirror = readAuthMirrorSessions(viewer.id);
      setHistoryEntries(
        mirror.map((session) => ({
          id: session.id,
          title: session.title,
          updatedAt: session.updatedAt,
          mode: session.mode,
        })),
      );
      return;
    }

    const payload = (await response.json()) as { sessions: SessionSummary[] };
    setHistoryEntries(payload.sessions);
  }

  async function loadAuthSession(sessionId: string) {
    const response = await fetch(`/api/ai/history/${sessionId}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      messages?: AiChatMessage[];
      id?: string;
      updatedAt?: string;
      title?: string;
    };

    if (!response.ok || !payload.messages) {
      if (viewer) {
        const mirror = readAuthMirrorSessions(viewer.id).find((session) => session.id === sessionId);
        if (mirror) {
          setActiveSessionId(mirror.id);
          setMessages(mirror.messages);
          setContextMeta(getLatestContextMeta(mirror.messages));
          setStatusNote("当前展示的是浏览器中的最近缓存记录。");
          setError(null);
          return;
        }
      }

      throw new Error(payload.message ?? "无法读取历史会话，请稍后重试。");
    }

    setActiveSessionId(sessionId);
    setMessages(payload.messages);
    setContextMeta(getLatestContextMeta(payload.messages));
    setStatusNote(null);
    setError(null);
  }

  function startNewConversation() {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
    setStatusNote(null);
    setError(null);
    setContextMeta({});
    setIsHistoryOpen(false);
  }

  async function selectConversation(sessionId: string) {
    setIsOpen(true);

    if (viewer) {
      await loadAuthSession(sessionId);
      setIsHistoryOpen(false);
      return;
    }

    const target = guestSessions.find((session) => session.id === sessionId);
    if (!target) return;
    setActiveSessionId(target.id);
    setMessages(target.messages);
    setContextMeta(getLatestContextMeta(target.messages));
    setStatusNote(null);
    setError(null);
    setIsHistoryOpen(false);
  }

  async function sendPrompt(promptValue?: string, overrides?: { assetId?: string; actionLogId?: string }) {
    const normalizedPrompt = (promptValue ?? input).trim();
    if (!normalizedPrompt || isSending) return;

    const nextContext = {
      assetId: overrides?.assetId ?? contextMeta.assetId,
      actionLogId: overrides?.actionLogId ?? contextMeta.actionLogId,
    };
    const timestamp = new Date().toISOString();
    const pageContext = {
      route: pathname,
      role: viewer?.role,
      assetId: nextContext.assetId,
      actionLogId: nextContext.actionLogId,
    };
    const userMessage: AiChatMessage = {
      id: createClientId("user"),
      role: "user",
      text: normalizedPrompt,
      createdAt: timestamp,
      meta: {
        route: pathname,
        assetId: nextContext.assetId,
        actionLogId: nextContext.actionLogId,
        mode,
      },
    };
    const previousMessages = messages;
    const optimisticMessages = [...previousMessages, userMessage].slice(-20);

    setIsOpen(true);
    setIsHistoryOpen(false);
    setContextMeta(nextContext);
    setMessages(optimisticMessages);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId ?? undefined,
          prompt: normalizedPrompt,
          history: viewer ? undefined : previousMessages.slice(-10),
          pageContext,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        sessionId?: string;
        reply?: string;
        provider?: "remote" | "fallback";
        baseUrl?: string;
      };

      if (!response.ok || !payload.reply) {
        throw new Error(payload.message ?? "KeyAI 暂时不可用。");
      }

      const assistantMessage: AiChatMessage = {
        id: createClientId("assistant"),
        role: "assistant",
        text: payload.reply,
        createdAt: new Date().toISOString(),
        meta: {
          route: pathname,
          assetId: nextContext.assetId,
          actionLogId: nextContext.actionLogId,
          provider: payload.provider,
          baseUrl: payload.baseUrl,
          mode,
        },
      };
      const finalMessages = [...optimisticMessages, assistantMessage].slice(-20);

      setMessages(finalMessages);
      setStatusNote(
        payload.provider === "fallback"
          ? "已切换到本地教学兜底模式，回答会更保守。"
          : "已连接 Mr.Brown 云端分析。",
      );

      if (viewer && payload.sessionId) {
        setActiveSessionId(payload.sessionId);
        const nextSession: AiChatSession = {
          id: payload.sessionId,
          userId: viewer.id,
          title:
            historyEntries.find((entry) => entry.id === payload.sessionId)?.title ??
            buildAiSessionTitle(normalizedPrompt),
          mode,
          messages: finalMessages,
          updatedAt: assistantMessage.createdAt,
        };
        writeAuthMirrorSessions(
          viewer.id,
          upsertGuestSession(readAuthMirrorSessions(viewer.id), nextSession),
        );
        await refreshAuthHistory();
        return;
      }

      const guestSessionId = payload.sessionId ?? activeSessionId ?? createClientId("guest-session");
      const existingGuestSession = guestSessions.find((session) => session.id === guestSessionId);
      const nextSession: AiChatSession = {
        id: guestSessionId,
        title: existingGuestSession?.title ?? buildAiSessionTitle(normalizedPrompt),
        mode,
        messages: finalMessages,
        updatedAt: assistantMessage.createdAt,
      };
      const nextSessions = upsertGuestSession(guestSessions, nextSession);
      setGuestSessions(nextSessions);
      writeGuestSessions(nextSessions);
      setActiveSessionId(guestSessionId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "KeyAI 暂时不可用。");
      setStatusNote("本次请求没有成功完成，你可以稍后重试。");
    } finally {
      setIsSending(false);
    }
  }

  // M6: useEffectEvent is still experimental in React 19.2.4. Mirror it with a
  // ref so the effect closure always sees the latest state callbacks without
  // re-subscribing on every render.
  const handleAssistantOpenRef = useRef<(detail: AiAssistantLaunchDetail) => void>(() => {});
  handleAssistantOpenRef.current = (detail: AiAssistantLaunchDetail) => {
    setIsOpen(true);
    setIsHistoryOpen(false);
    setError(null);

    const nextContext = {
      assetId: detail.assetId,
      actionLogId: detail.actionLogId,
    };
    setContextMeta(nextContext);

    if (detail.prompt) {
      setInput(detail.prompt);
      if (detail.autoSend) {
        void sendPrompt(detail.prompt, nextContext);
      }
    }
  };
  const handleAssistantOpen = useCallback((detail: AiAssistantLaunchDetail) => {
    handleAssistantOpenRef.current(detail);
  }, []);

  useEffect(() => {
    const handleWindowOpen = (event: Event) => {
      handleAssistantOpen((event as CustomEvent<AiAssistantLaunchDetail>).detail ?? {});
    };

    window.addEventListener(AI_ASSISTANT_OPEN_EVENT, handleWindowOpen);
    return () => {
      window.removeEventListener(AI_ASSISTANT_OPEN_EVENT, handleWindowOpen);
    };
  }, [handleAssistantOpen]);

  useEffect(() => {
    if (viewerKey !== "guest") {
      // Shared-computer privacy (H3): a logged-in session wipes any *other* user's
      // lingering AI storage (and the guest cache), keeping only this user's mirror.
      clearBrownZoneAiStorage(viewerKey);
      setActiveSessionId(null);
      setMessages([]);
      setContextMeta({});
      setGuestSessions([]);
      void (async () => {
        const response = await fetch("/api/ai/history", { cache: "no-store" });
        if (!response.ok) {
          const mirror = readAuthMirrorSessions(viewerKey);
          setHistoryEntries(
            mirror.map((session) => ({
              id: session.id,
              title: session.title,
              updatedAt: session.updatedAt,
              mode: session.mode,
            })),
          );
          return;
        }

        const payload = (await response.json()) as { sessions: SessionSummary[] };
        setHistoryEntries(payload.sessions);
      })();
      return;
    }

    setActiveSessionId(null);
    setMessages([]);
    setContextMeta({});
    const sessions = readGuestSessions();
    setGuestSessions(sessions);
  }, [viewerKey]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "end" });
  }, [isOpen, messages]);

  // B: 让调度闭包始终看到最新的开合状态，而无需把 isOpen 放进依赖去重启定时器。
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // B: 任何方式打开面板（悬浮球 / 气泡 / 外部事件 / 自动发送）都在本会话静默气泡，
  //     并立即收起当前气泡。面板开着时不弹。
  useEffect(() => {
    if (!isOpen) return;
    setBubbleVisible(false);
    try {
      window.sessionStorage.setItem(BUBBLE_DISMISSED_KEY, "1");
    } catch {
      // sessionStorage 不可用时静默降级——气泡仅是营销提醒，不影响主流程。
    }
  }, [isOpen]);

  // B: 挂载后 8s 首次滑出、停留 4s 收起，之后每 60s 轮换出现，最多 3 次；
  //     用户本会话打开过面板后永不再弹。所有定时器在卸载/静默时清理。
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isBubbleDismissed = () => {
      try {
        return window.sessionStorage.getItem(BUBBLE_DISMISSED_KEY) === "1";
      } catch {
        return false;
      }
    };

    if (isBubbleDismissed()) return;

    let shows = 0;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const popOnce = () => {
      if (isBubbleDismissed() || isOpenRef.current) return;
      setBubbleIndex(shows % BUBBLE_MESSAGES.length);
      shows += 1;
      setBubbleVisible(true);
      const hideTimer = setTimeout(() => setBubbleVisible(false), BUBBLE_VISIBLE_MS);
      timers.push(hideTimer);
    };

    const firstTimer = setTimeout(() => {
      popOnce();
      const intervalTimer = setInterval(() => {
        if (shows >= BUBBLE_MAX_SHOWS || isBubbleDismissed()) {
          clearInterval(intervalTimer);
          return;
        }
        popOnce();
      }, BUBBLE_INTERVAL_MS);
      timers.push(intervalTimer);
    }, BUBBLE_FIRST_DELAY_MS);
    timers.push(firstTimer);

    return () => {
      timers.forEach((timer) => {
        clearTimeout(timer);
        clearInterval(timer);
      });
    };
  }, []);

  const placeholder =
    mode === "student-context"
      ? "询问当前这只股票或者这笔交易的情况..."
      : "问我任何问题...";

  return (
    <>
      <div className="safe-floating-offset pointer-events-none fixed z-[70]">
        {/* B: 周期性标语气泡——纯营销提醒(aria-hidden，不进读屏)，贴悬浮球上方右对齐。
            点击等同点击悬浮球打开面板；非 focusable、不占 tab 序，可访问名由按钮承载。
            轻微 slide+fade，尊重 reduced-motion。 */}
        <div
          aria-hidden="true"
          onClick={() => {
            setIsOpen(true);
            setIsHistoryOpen(false);
            if (viewer) {
              void refreshAuthHistory();
            }
          }}
          className={cn(
            "absolute bottom-full right-0 mb-3 cursor-pointer whitespace-nowrap rounded-2xl bg-[var(--ink-800)] px-4 py-2.5 text-sm font-semibold text-white shadow-xl shadow-slate-950/25 transition-all duration-300 ease-out motion-reduce:transition-none",
            bubbleVisible
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-1 opacity-0",
          )}
        >
          {BUBBLE_MESSAGES[bubbleIndex]}
        </div>
        <button
          type="button"
          data-motion-button
          onClick={() => {
            setIsOpen(true);
            setIsHistoryOpen(false);
            if (viewer) {
              void refreshAuthHistory();
            }
          }}
          className="group pointer-events-auto relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--ink-700)] text-white shadow-2xl shadow-slate-950/30 sm:h-16 sm:w-16"
          data-allow-overflow="true"
          aria-label="打开 KeyAI"
        >
          {/* 悬浮球换装：Brown Zone 吉祥物；圆形裁切由按钮 overflow-hidden rounded-full 完成。
              图片纯装饰（alt=""），可访问名由按钮 aria-label 承载。hover 轻微放大。 */}
          <Image
            src="/brand/v3/ai-assistant-mascot.webp"
            alt=""
            width={64}
            height={64}
            sizes="64px"
            priority
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </button>
      </div>

      {isOpen ? (
          <>
            <button
              type="button"
              data-motion-overlay
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[71] bg-slate-950/18 backdrop-blur-[2px]"
              aria-label="关闭 KeyAI 面板"
            />

            <div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="KeyAI 助手"
              data-motion-drawer
              data-motion-side="bottom"
              className="fixed inset-x-3 bottom-3 top-3 z-[72] flex flex-col overflow-hidden rounded-[1.85rem] border border-white/12 bg-bg-app shadow-2xl shadow-slate-950/20 focus:outline-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:h-[min(760px,calc(100svh-32px))] sm:w-[min(420px,calc(100vw-32px))] sm:rounded-[2rem]"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  {/* 面板头像同悬浮球换 Brown Zone 吉祥物；alt="" 纯装饰，
                      MR.BROWN 眉标 + KeyAI 标题已承载可访问名。 */}
                  <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-slate-700/20">
                    <Image
                      src="/brand/v3/ai-assistant-mascot.webp"
                      alt=""
                      width={44}
                      height={44}
                      sizes="44px"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-brand">Mr.Brown</p>
                    <h2 className="text-[1.75rem] font-semibold tracking-tight text-slate-950">KeyAI</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  aria-label="关闭对话框"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="border-b border-slate-200 bg-white px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                    {mode === "student-context"
                      ? "学生强上下文"
                      : mode === "platform-generic"
                        ? "登录后通用问答"
                        : "游客模式"}
                  </span>
                  {statusNote ? (
                    <span
                      role="status"
                      className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-medium text-brand-ink"
                    >
                      {statusNote}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="relative flex-1 overflow-hidden bg-bg-muted">
                {isHistoryOpen ? (
                    <div
                      data-motion-drawer
                      data-motion-side="right"
                      className="absolute inset-0 z-10 overflow-y-auto bg-white/96 p-5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-brand">History</p>
                          <h3 className="mt-1 text-lg font-semibold text-slate-950">最近会话</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsHistoryOpen(false)}
                          className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600"
                        >
                          返回
                        </button>
                      </div>

                      <div className="mt-5 space-y-3">
                        {sessionEntries.length ? (
                          sessionEntries.map((session) => (
                            <button
                              key={session.id}
                              type="button"
                              onClick={() => {
                                void selectConversation(session.id);
                              }}
                              className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:border-brand hover:bg-brand-subtle"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold text-slate-950">{session.title}</p>
                                <span className="text-xs text-slate-600">
                                  {formatDateLabel(new Date(session.updatedAt))}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-500">
                                {session.mode === "student-context"
                                  ? "学生强上下文"
                                  : session.mode === "platform-generic"
                                    ? "登录后问答"
                                    : "游客问答"}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                            这里还没有历史会话。你可以先开始一段新的提问。
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                {/* itest9 a11y P2(4.1.3)：聊天记录设为 log 实时区，新增的 AI 回复才会被读屏自动播报。 */}
                <div
                  className="h-full overflow-y-auto px-5 py-5"
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                  aria-label="KeyAI 对话记录"
                >
                  {messages.length ? (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            message.role === "user" ? "justify-end" : "justify-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[84%] rounded-[1.5rem] px-4 py-3 shadow-sm",
                              message.role === "user"
                                ? "bg-[var(--ink-700)] text-white"
                                : "bg-white text-slate-800",
                            )}
                          >
                            <p className="whitespace-pre-wrap text-sm leading-7">{message.text}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col justify-between gap-6">
                      <div className="flex flex-col items-center pt-8 text-center">
                        {/* 空态改为居中小吉祥物 + 单句引导；副句删——下方快捷提问 chips 本身即引导。 */}
                        <div className="h-[72px] w-[72px] overflow-hidden rounded-full shadow-md shadow-slate-300/60">
                          <Image
                            src="/brand/v3/ai-assistant-mascot.webp"
                            alt=""
                            width={72}
                            height={72}
                            sizes="72px"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p className="mt-4 text-sm font-medium text-slate-700">和 Mr.Brown 聊聊你的沙盘。</p>
                      </div>

                      <div className="grid gap-3">
                        {starterPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => {
                              void sendPrompt(prompt);
                            }}
                            className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 text-left text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-brand hover:bg-brand-subtle"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="safe-drawer-offset border-t border-slate-200 bg-[var(--ink-700)] p-4 text-white">
                {error ? (
                  <div role="alert" className="mb-3 rounded-[1.2rem] bg-white/8 px-3 py-2 text-sm text-white/80">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-end gap-3">
                  <label className="flex-1 rounded-[1.5rem] bg-white/6 px-4 py-3">
                    <textarea
                      value={input}
                      rows={2}
                      aria-label="给 KeyAI 的消息"
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendPrompt();
                        }
                      }}
                      placeholder={placeholder}
                      className="max-h-32 min-h-[52px] w-full resize-none bg-transparent text-sm leading-7 text-white outline-none placeholder:text-white/55"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => {
                      void sendPrompt();
                    }}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-brand !text-slate-950 shadow-lg shadow-brand/30 transition-transform hover:-translate-y-0.5 hover:bg-brand-hover disabled:opacity-60"
                    aria-label="发送消息"
                  >
                    {isSending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={startNewConversation}
                      className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold !text-slate-950 shadow-lg shadow-brand/30 transition-transform hover:-translate-y-0.5 hover:bg-brand-hover"
                    >
                      <Plus className="h-4 w-4" />
                      New
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (viewer) {
                          void refreshAuthHistory();
                        }
                        setIsHistoryOpen((current) => !current);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <History className="h-4 w-4" />
                      History
                    </button>
                  </div>

                  <div className="hidden items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-xs text-white/72 sm:inline-flex">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    {viewer ? `${viewer.name} 的会话` : "游客临时会话"}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
    </>
  );
}
