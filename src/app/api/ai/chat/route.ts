import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requestChatReply } from "@/lib/ai";
import { buildAiSessionTitle } from "@/lib/assistant-config";
import { buildAssistantContextBundle } from "@/lib/assistant-context";
import { readSession } from "@/lib/auth";
import { resolveSubscriptionState } from "@/lib/billing/subscription";
import {
  appendAiMessages,
  createAiSession,
  findUserById,
  getAiSessionById,
} from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";
import type { AiChatMessage, AiChatPageContext, Role } from "@/lib/types";
import { createId } from "@/lib/utils";

const roleSchema = z.enum(["student", "teacher", "parent", "admin"]);

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(4000),
  createdAt: z.string().optional(),
  meta: z
    .object({
      route: z.string().optional(),
      assetId: z.string().optional(),
      actionLogId: z.string().optional(),
      provider: z.enum(["remote", "fallback"]).optional(),
      baseUrl: z.string().optional(),
      mode: z.enum(["guest", "platform-generic", "student-context"]).optional(),
    })
    .optional(),
});

const chatSchema = z.object({
  sessionId: z.string().optional(),
  prompt: z.string().min(2).max(1200),
  history: z.array(messageSchema).max(20).optional(),
  pageContext: z.object({
    route: z.string().min(1),
    role: roleSchema.optional(),
    assetId: z.string().optional(),
    actionLogId: z.string().optional(),
  }),
});

function createChatMessage(
  role: "user" | "assistant",
  text: string,
  pageContext: AiChatPageContext,
  extra?: Partial<AiChatMessage["meta"]>,
): AiChatMessage {
  return {
    id: createId(`ai-${role}`),
    role,
    text,
    createdAt: new Date().toISOString(),
    meta: {
      route: pageContext.route,
      assetId: pageContext.assetId,
      actionLogId: pageContext.actionLogId,
      ...extra,
    },
  };
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const body = chatSchema.parse(await request.json());
    const session = await readSession();
    const user = session ? await findUserById(session.userId) : null;
    if (session && (!user || (user.tokenVersion ?? 0) !== (session.tv ?? 0))) {
      return apiError("unauthorized", "会话已失效，请重新登录。", 401);
    }

    // H4: per-user (or per-IP for guests) sliding window. 20 prompts/minute is
    // generous for legitimate use but caps abuse / cost-bomb risk.
    const rl = rateLimit(rateLimitKey("ai-chat", user?.id, request), 20, 60_000);
    if (!rl.ok) {
      return apiError("service_unavailable", buildRateLimitMessage(rl), 429);
    }

    const contextBundle = await buildAssistantContextBundle({
      route: body.pageContext.route,
      user,
      pageContext: body.pageContext,
    });
    if (user?.role === "student" && contextBundle.mode === "student-context") {
      const subscription = resolveSubscriptionState(
        user.subscriptionTier,
        user.trialExpiresAt,
        user.subscriptionExpiresAt,
      );
      if (subscription.aiTier === "none") {
        return apiError(
          "forbidden",
          subscription.bannerMessage ?? "试用已结束，升级后即可继续使用 KeyAI 学生上下文问答。",
          403,
        );
      }
    }

    const pageContext: AiChatPageContext = {
      route: body.pageContext.route,
      role: user?.role ?? (body.pageContext.role as Role | undefined),
      assetId: body.pageContext.assetId,
      actionLogId: body.pageContext.actionLogId,
    };

    const userMessage = createChatMessage("user", body.prompt, pageContext, {
      mode: contextBundle.mode,
    });

    if (!user) {
      // H5: guest mode ignores client-supplied history so a malicious caller
      // cannot inject fake "assistant" turns to jailbreak the system prompt.
      const reply = await requestChatReply({
        mode: contextBundle.mode,
        prompt: body.prompt,
        contextBlock: contextBundle.contextBlock,
        history: [userMessage],
        role: pageContext.role,
      });

      return NextResponse.json({
        sessionId: body.sessionId ?? createId("guest-session"),
        reply: reply.text,
        provider: reply.provider,
        baseUrl: reply.baseUrl,
        mode: contextBundle.mode,
        starterPrompts: contextBundle.starterPrompts,
      });
    }

    let activeSession = body.sessionId ? await getAiSessionById(body.sessionId, user.id) : null;
    if (body.sessionId && !activeSession) {
      return apiError("not_found", "当前会话不存在或无权访问。", 404);
    }

    if (!activeSession) {
      activeSession = await createAiSession({
        userId: user.id,
        mode: contextBundle.mode,
        title: buildAiSessionTitle(body.prompt),
      });
    }

    // H9: call AI first, then commit user + assistant turns in a single
    // transaction. A remote failure now leaves the session untouched instead
    // of stranding an orphan user message with no reply.
    const history = [...(activeSession.messages ?? []), userMessage];

    const reply = await requestChatReply({
      mode: contextBundle.mode,
      prompt: body.prompt,
      contextBlock: contextBundle.contextBlock,
      history,
      role: user.role,
    });

    const assistantMessage = createChatMessage("assistant", reply.text, pageContext, {
      provider: reply.provider,
      baseUrl: reply.baseUrl,
      mode: contextBundle.mode,
    });

    await appendAiMessages(activeSession.id, user.id, [userMessage, assistantMessage]);

    return NextResponse.json({
      sessionId: activeSession.id,
      reply: reply.text,
      provider: reply.provider,
      baseUrl: reply.baseUrl,
      mode: contextBundle.mode,
      starterPrompts: contextBundle.starterPrompts,
    });
  } catch (error) {
    return handleRouteError(error, "KeyAI 暂时不可用。");
  }
}
