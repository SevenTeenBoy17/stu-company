import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/billing/subscription", () => ({ canUserOperate: vi.fn() }));
vi.mock("@/lib/db/repo", () => ({
  claimSeasonRewardForUser: vi.fn(),
  createFundLabActionForUser: vi.fn(),
  createGoalAccountActionForUser: vi.fn(),
  createOpportunityNoteForUser: vi.fn(),
  createProtectionUmbrellaActionForUser: vi.fn(),
  createStudentWatchlistActionForUser: vi.fn(),
  getSimulationStateForUser: vi.fn(),
}));
vi.mock("@/lib/market-data", () => ({ getMarketBoardPayload: vi.fn() }));
vi.mock("@/lib/market-watchlist", () => ({ resolveMarketWatchlistSymbol: vi.fn((symbol?: string | null) => symbol ?? "MU") }));
vi.mock("@/lib/student-watchlist", () => ({ buildStudentWatchlistPayload: vi.fn(() => ({ kind: "watchlist" })) }));
vi.mock("@/lib/fund-lab", () => ({ buildFundLabPayload: vi.fn(() => ({ kind: "fund-lab" })) }));
vi.mock("@/lib/opportunity", () => ({ buildOpportunityPayload: vi.fn(() => ({ kind: "opportunity" })) }));
vi.mock("@/lib/goal-accounts", () => ({ buildGoalAccountsPayload: vi.fn(() => ({ kind: "goal-accounts" })) }));
vi.mock("@/lib/protection-umbrella", () => ({ buildProtectionUmbrellaPayload: vi.fn(() => ({ kind: "protection" })) }));
vi.mock("@/lib/season-challenges", () => ({ buildStudentSeasonChallengePayload: vi.fn(() => ({ kind: "season" })) }));

import { requireUser } from "@/lib/api-guard";
import { canUserOperate } from "@/lib/billing/subscription";
import {
  claimSeasonRewardForUser,
  createFundLabActionForUser,
  createGoalAccountActionForUser,
  createOpportunityNoteForUser,
  createProtectionUmbrellaActionForUser,
  createStudentWatchlistActionForUser,
  getSimulationStateForUser,
} from "@/lib/db/repo";
import { getMarketBoardPayload } from "@/lib/market-data";

import { POST as fundLabPost } from "./fund-lab/route";
import { POST as goalAccountsPost } from "./goal-accounts/route";
import { POST as opportunityPost } from "./opportunity/route";
import { POST as protectionPost } from "./protection/route";
import { POST as seasonPost } from "./season/route";
import { POST as watchlistPost } from "./watchlist/route";

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

const STUDENT = {
  id: "student-1",
  role: "student",
  subscriptionTier: "standard",
  trialExpiresAt: null,
  subscriptionExpiresAt: "2099-01-01T00:00:00.000Z",
};

const asRequireUser = (value: unknown) => value as Awaited<ReturnType<typeof requireUser>>;
const asSimulationState = (value: unknown) => value as Awaited<ReturnType<typeof getSimulationStateForUser>>;

const postCases = [
  {
    label: "watchlist",
    post: watchlistPost,
    body: { symbol: "MU", action: "add", reason: "观察 AI 存储周期" },
    writeMock: createStudentWatchlistActionForUser,
  },
  {
    label: "fund-lab",
    post: fundLabPost,
    body: { intent: "record", plan: "balanced", amount: 5000 },
    writeMock: createFundLabActionForUser,
  },
  {
    label: "opportunity",
    post: opportunityPost,
    body: { cardId: "ai-infra", reason: "capital", confidence: 62, note: "先记录证据链，再观察风险变化。" },
    writeMock: createOpportunityNoteForUser,
  },
  {
    label: "goal-accounts",
    post: goalAccountsPost,
    body: { goalId: "emergency", amount: 500 },
    writeMock: createGoalAccountActionForUser,
  },
  {
    label: "protection",
    post: protectionPost,
    body: { planId: "basic", stressId: "expense-shock" },
    writeMock: createProtectionUmbrellaActionForUser,
  },
  {
    label: "season",
    post: seasonPost,
    body: { challengeId: "steady-config-week" },
    writeMock: claimSeasonRewardForUser,
  },
] as const;

describe("student POST write routes subscription gates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(canUserOperate).mockReturnValue(true);
    vi.mocked(getSimulationStateForUser).mockResolvedValue(asSimulationState({ run: {} }));
    vi.mocked(getMarketBoardPayload).mockResolvedValue({} as never);
    vi.mocked(createStudentWatchlistActionForUser).mockResolvedValue({ run: {}, entry: { id: "entry-1" } } as never);
    vi.mocked(createFundLabActionForUser).mockResolvedValue({ payload: { kind: "fund-lab" } } as never);
    vi.mocked(createOpportunityNoteForUser).mockResolvedValue({
      payload: { kind: "opportunity" },
      note: { id: "note-1" },
    } as never);
    vi.mocked(createGoalAccountActionForUser).mockResolvedValue({
      payload: { kind: "goal-accounts" },
      entry: { id: "goal-1" },
    } as never);
    vi.mocked(createProtectionUmbrellaActionForUser).mockResolvedValue({
      payload: { kind: "protection" },
      entry: { id: "protection-1" },
    } as never);
    vi.mocked(claimSeasonRewardForUser).mockResolvedValue({
      payload: { kind: "season" },
      claimed: { id: "reward-1" },
    } as never);
  });

  it.each(postCases)("blocks %s POST when trial/subscription cannot operate", async ({ post, body, writeMock }) => {
    vi.mocked(canUserOperate).mockReturnValue(false);

    const res = await post(makeRequest(body));

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
    expect(json.message).toContain("试用已结束");
    expect(writeMock).not.toHaveBeenCalled();
  });

  it.each(postCases)("allows %s POST through for an active subscriber", async ({ post, body, writeMock }) => {
    vi.mocked(canUserOperate).mockReturnValue(true);

    const res = await post(makeRequest(body));

    expect(res.status).toBe(200);
    expect(writeMock).toHaveBeenCalled();
  });
});
