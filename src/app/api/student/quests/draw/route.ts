import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { drawCard, seedFromString, type QuestCard } from "@/lib/cards";
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

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("invalid_input", "请选择要抽取卡片的已完成任务。", 400);
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
      return apiError("forbidden", "这个任务还没有完成，暂时不能抽取装饰卡。", 403);
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
    const seed = seedFromString(
      [auth.user.id, state.run.id, state.run.currentRound, parsed.data.questId, parsed.data.source].join(":"),
    );
    const card = drawCard(questCardDeck, ownedCardIds, seed);
    const collectionItem = await drawCardForUser(auth.user.id, {
      cardId: card.id,
      source: parsed.data.source,
      meta: {
        questId: quest.id,
        questTitle: quest.title,
        reward: quest.reward,
        runId: state.run.id,
        round: state.run.currentRound,
        seed,
        rarity: card.rarity,
      },
    });

    return NextResponse.json({
      card,
      collectionItem,
      alreadyDrawn: false,
    });
  } catch (error) {
    return handleRouteError(error, "任务装饰卡抽取失败，请稍后再试。");
  }
}
