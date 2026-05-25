import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requestChatReply } from "@/lib/ai";
import { buildAiSessionTitle } from "@/lib/assistant-config";
import { buildAssistantContextBundle } from "@/lib/assistant-context";
import { readSession } from "@/lib/auth";
import {
  appendAiMessage,
  createAiSession,
  findUserById,
  getAiSessionById,
} from "@/lib/db/repo";
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

function normalizeHistoryMessages(messages: Array<z.infer<typeof messageSchema>> = []): AiChatMessage[] {
  return messages.map((message) => ({
    id: createId(`history-${message.role}`),
    role: message.role,
    text: message.text,
    createdAt: message.createdAt ?? new Date().toISOString(),
    meta: message.meta,
  }));
}

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
  try {
    const body = chatSchema.parse(await request.json());
    const session = await readSession();
    const user = session ? await findUserById(session.userId) : null;

    const contextBundle = buildAssistantContextBundle({
      route: body.pageContext.route,
      user,
      pageContext: body.pageContext,
    });

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
      const guestHistory = normalizeHistoryMessages(body.history ?? []);
      const reply = await requestChatReply({
        mode: contextBundle.mode,
        prompt: body.prompt,
        contextBlock: contextBundle.contextBlock,
        history: [...guestHistory, userMessage],
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

    await appendAiMessage(activeSession.id, user.id, userMessage);
    const latestSession = await getAiSessionById(activeSession.id, user.id);

    const reply = await requestChatReply({
      mode: contextBundle.mode,
      prompt: body.prompt,
      contextBlock: contextBundle.contextBlock,
      history: latestSession?.messages ?? [userMessage],
      role: user.role,
    });

    await appendAiMessage(
      activeSession.id,
      user.id,
      createChatMessage("assistant", reply.text, pageContext, {
        provider: reply.provider,
        baseUrl: reply.baseUrl,
        mode: contextBundle.mode,
      }),
    );

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
