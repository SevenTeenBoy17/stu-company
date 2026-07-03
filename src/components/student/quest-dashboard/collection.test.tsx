import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { questCardSeries, type QuestCardSeries } from "@/lib/cards";
import { questCardDeck } from "@/lib/content";

import { CollectionMeter } from "./collection";
import type { QuestCardCollectionView } from "./shared";

function collectionFor(series: QuestCardSeries): QuestCardCollectionView[] {
  return questCardDeck
    .filter((card) => questCardSeries(card) === series)
    .map(
      (card) =>
        ({
          id: `row-${card.id}`,
          userId: "student-1",
          cardId: card.id,
          source: "quest_claim",
          drawnAt: "2026-07-01T00:00:00.000Z",
          meta: {},
          card,
        }) as unknown as QuestCardCollectionView,
    );
}

describe("CollectionMeter 套系集齐学习巩固 CTA", () => {
  it("集齐 foundations 显示指向 /learn 的巩固入口；未集齐的套系不显示", () => {
    render(<CollectionMeter items={collectionFor("foundations")} />);

    const cta = screen.getByTestId("series-consolidation-cta-foundations");
    expect(cta).toHaveAttribute("href", "/learn");
    expect(screen.queryByTestId("series-consolidation-cta-risk-control")).not.toBeInTheDocument();
    expect(screen.queryByTestId("series-consolidation-cta-systems-thinking")).not.toBeInTheDocument();
  });

  it("CTA 奖励非稀缺（苏格拉底约束）：文案不得出现发卡/稀缺/限定类词汇", () => {
    render(<CollectionMeter items={collectionFor("risk-control")} />);

    const cta = screen.getByTestId("series-consolidation-cta-risk-control");
    expect(cta.textContent ?? "").not.toMatch(/新卡|独占|限定|稀有|抽|解锁卡/);
    expect(cta.textContent ?? "").toMatch(/小测/);
  });
});
