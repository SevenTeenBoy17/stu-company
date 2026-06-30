import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { drawCard, questCardSeries, type QuestCard } from "@/lib/cards";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { questCardDeck } from "@/lib/content";
import {
  drawCardForUser,
  getLearningProgress,
  getSimulationStateForUser,
  listCardCollectionForUser,
  type CardCollectionItem,
  type CardCollectionSource,
} from "@/lib/db/repo";
import { buildStudentQuestPayload } from "@/lib/quests";
import { computeTaskCenterTelemetry } from "@/lib/simulation";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  questId: z.string().trim().min(3),
  source: z.literal("quest_claim").default("quest_claim"),
});

function findDeckCard(cardId: string): QuestCard | undefined {
  return questCardDeck.find((card) => card.id === cardId);
}

function existingCardForTrigger(
  collection: CardCollectionItem[],
  source: CardCollectionSource,
  questId: string,
): CardCollectionItem | undefined {
  return collection.find(
    (item) => item.source === source && typeof item.meta?.questId === "string" && item.meta.questId === questId,
  );
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const auth = await requireUser("student");
    if (auth.error) return auth.error;

    if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
      return apiError("forbidden", "试用已结束，请升级后继续领取任务学习卡。", 403);
    }

    const rl = rateLimit(rateLimitKey("quest-draw", auth.user.id, request), 20, 60_000);
    if (!rl.ok) {
      return apiError("service_unavailable", buildRateLimitMessage(rl), 429);
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("invalid_input", "请选择要领取学习卡的已完成任务。", 400);
    }

    const [state, learning, collection] = await Promise.all([
      getSimulationStateForUser(auth.user.id),
      getLearningProgress(auth.user.id),
      listCardCollectionForUser(auth.user.id),
    ]);

    const payload = buildStudentQuestPayload(state.run, learning);
    const quest = payload.quests.find((item) => item.id === parsed.data.questId);
    if (!quest) {
      return apiError("invalid_input", "任务不存在，请刷新任务中心后再试。", 400);
    }
    if (!quest.claimable && !quest.claimed) {
      return apiError("forbidden", "这个任务还没有完成，暂时不能领取学习卡。", 403);
    }

    const alreadyDrawn = existingCardForTrigger(collection, parsed.data.source, parsed.data.questId);
    if (alreadyDrawn) {
      const card = findDeckCard(alreadyDrawn.cardId);
      if (!card) {
        return apiError("invalid_input", "这张卡片配置已更新，请联系管理员刷新卡库。", 400);
      }

      return NextResponse.json({
        card,
        collectionItem: alreadyDrawn,
        alreadyDrawn: true,
      });
    }

    const ownedCardIds = collection.map((item) => item.cardId);
    // 去随机化（合规）：确定性领取下一张未拥有卡，不再用含 user.id 的 seed 生成收藏分组。
    const card = drawCard(questCardDeck, ownedCardIds);
    const collectionItem = await drawCardForUser(auth.user.id, {
      cardId: card.id,
      source: parsed.data.source,
      meta: {
        questId: quest.id,
        questTitle: quest.title,
        reward: quest.reward,
        runId: state.run.id,
        round: state.run.currentRound,
        rarity: card.rarity,
        category: quest.category,
      },
    });

    // 学习护栏遥测（H3）：以稳定前缀结构化日志记录交易占比 + 学习连续，供聚合监测；
    // 无 PII（仅 run id）、无新表/外部 provider——遥测目的地的架构决策留给后续，但度量已就位。
    const telemetry = computeTaskCenterTelemetry(state.run);
    console.info(
      `[task-center] event=draw run=${state.run.id} round=${state.run.currentRound} ` +
        `series=${questCardSeries(card)} tradeShare=${telemetry.tradeShare.toFixed(3)} ` +
        `learningStreak=${telemetry.learningStreakBest} guardrail=${telemetry.guardrailHealthy ? "ok" : "alert"}`,
    );

    return NextResponse.json({
      card,
      collectionItem,
      alreadyDrawn: false,
    });
  } catch (error) {
    return handleRouteError(error, "任务学习卡领取失败，请稍后再试。");
  }
}
