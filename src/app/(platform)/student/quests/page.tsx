import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { SubscriptionBanner } from "@/components/shared/subscription-banner";
import { StudentQuestDashboard, type QuestCardCollectionView } from "@/components/student/student-quest-dashboard";
import { resolveSubscriptionState } from "@/lib/billing/subscription";
import type { QuestCard } from "@/lib/cards";
import { questCardDeck } from "@/lib/content";
import { getLearningProgress, getSimulationStateForUser, listCardCollectionForUser, roleHomePath } from "@/lib/db/repo";
import { buildStudentQuestPayload } from "@/lib/quests";
import { buildStudentSeasonChallengePayload } from "@/lib/season-challenges";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "任务中心 - Brown Zone",
  description: "把真实沙盘行为转化为任务、成就和收益日历，帮助学生在玩中学会多元理财习惯。",
};

export default async function StudentQuestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const [state, learning, collection] = await Promise.all([
    getSimulationStateForUser(user.id),
    getLearningProgress(user.id),
    listCardCollectionForUser(user.id),
  ]);
  const payload = buildStudentQuestPayload(state.run, learning);
  const seasonPayload = buildStudentSeasonChallengePayload(state.run);
  const subState = resolveSubscriptionState(
    user.subscriptionTier,
    user.trialExpiresAt,
    user.subscriptionExpiresAt,
  );
  const cardCollection = collection.reduce<QuestCardCollectionView[]>((items, item) => {
    const card = questCardDeck.find((deckCard) => deckCard.id === item.cardId);
    if (card) items.push({ ...item, card: card as QuestCard });
    return items;
  }, []);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <SubscriptionBanner state={subState} role={user.role} />
      <StudentQuestDashboard payload={payload} seasonPayload={seasonPayload} initialCollection={cardCollection} />
    </PlatformLayout>
  );
}
