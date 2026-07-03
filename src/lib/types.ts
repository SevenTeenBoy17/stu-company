export type Role = "student" | "teacher" | "parent" | "admin";
export type AiChatMode = "guest" | "platform-generic" | "student-context";
export type MarketWatchlistSymbol =
  | "MU"
  | "MSFT"
  | "NVDA"
  | "AMZN"
  | "META"
  | "GOOG"
  | "AVGO"
  | "ORCL"
  | "TSLA"
  | "TSM";
export type MarketQuoteSource = "tsanghi" | "itick" | "alltick" | "fallback";
export type MarketDataProvider = "tsanghi" | "itick" | "alltick" | "hybrid" | "fallback";
// 市场雷达分类：美股 / A股 / 港股 / 基金(ETF)。详见 src/lib/market-catalog.ts。
export type MarketCategoryId = "us" | "cn" | "hk" | "fund";

export type ModuleKey =
  | "equities"
  | "portfolio"
  | "banking"
  | "property"
  | "venture"
  | "events"
  | "competition"
  | "guardian";

export type AssetCategory = "stock" | "etf" | "bond" | "commodity" | "fx";

export type OrderMode = "market" | "limit";

export type BankingAction = "deposit" | "withdraw" | "loan" | "repay";
export type PropertyAction = "buy" | "sell";
export type VentureAction = "invest" | "exit";

export interface NavGroup {
  title: string;
  summary: string;
  items: { label: string; href: string; description: string }[];
}

export interface LearningModule {
  key: ModuleKey;
  title: string;
  tagline: string;
  description: string;
  level: "核心" | "进阶" | "运营" | "家校";
  highlights: string[];
  /** External "深入学习" link — mapped to the closest 富途牛牛课堂 (futunn.com/learn) section. */
  href: string;
  /** Short label for that destination section, shown on the card CTA. */
  hrefLabel: string;
}

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  description: string;
  basePrice: number;
  risk: "低" | "中" | "高";
}

export interface MarketRound {
  round: number;
  theme: string;
  headline: string;
  summary: string;
  assetMultipliers: Record<AssetCategory, number>;
  liquidityBoost: number;
  eventId: string;
}

export interface Holding {
  assetId: string;
  quantity: number;
  averageCost: number;
}

/**
 * E3: an interactive choice on a decision-card event. `outcome` drives a
 * deterministic (seeded) consequence resolved in the engine — see
 * resolveEventChoice in src/lib/event-engine.ts.
 */
export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  teachingPoint: string;
  outcome: "protect" | "hold" | "gamble";
}

export interface EventCard {
  id: string;
  title: string;
  category: "macro" | "policy" | "sentiment" | "competition" | "black_swan" | "behavior";
  signal: "利好" | "利空" | "中性";
  description: string;
  coachingCue: string;
  teachingConcept?: string;
  impactAssets?: AssetCategory[];
  impactRange?: "low" | "medium" | "high";
  stage?: "early" | "middle" | "late";
  /** E3: when present, the event is a decision-card the player must respond to. */
  choices?: EventChoice[];
}

export type FinancialEventCard = EventCard;

export interface ActionLog {
  id: string;
  round: number;
  type:
    | "trade"
    | "bank"
    | "property"
    | "venture"
    | "advance"
    | "event"
    | "auto_invest"
    | "quest"
    | "opportunity"
    | "fund_lab"
    | "goal_account"
    | "protection"
    | "watchlist"
    | "wealth_review";
  label: string;
  amount: number;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface PortfolioSnapshot {
  round: number;
  netWorth: number;
  cash: number;
  savings: number;
  debt: number;
  riskScore: number;
  disciplineScore: number;
  reflection: string;
}

export interface ScenarioRun {
  id: string;
  userId: string;
  classroomId: string;
  scenarioName: string;
  currentRound: number;
  totalRounds: number;
  cash: number;
  savings: number;
  debt: number;
  propertyUnits: number;
  propertyBasis: number;
  ventureStake: number;
  ventureBasis: number;
  holdings: Holding[];
  eventHistory: string[];
  actionLog: ActionLog[];
  snapshots: PortfolioSnapshot[];
  lastInsight?: string;
  /**
   * Seed for the per-run random-event engine (src/lib/event-engine.ts).
   * Stored so a run is reproducible (a teacher can replay an identical scenario).
   * Optional for backward compatibility: legacy runs without a seed fall back to
   * the fixed `marketRounds` script and an event-free (deterministic) market.
   */
  seed?: number;
  /** Per-round event ids chosen from `seed`; index 0 = round 1. */
  eventTimeline?: string[];
  /** Materialized latest net worth (kept in sync in commitSnapshot) so the weekly
   * season leaderboard can ORDER BY ... LIMIT in SQL instead of loading every run. */
  netWorth?: number;
}

export type RoundPredictionGuess = "up" | "down";

export interface RoundPrediction {
  id: string;
  userId: string;
  runId: string;
  round: number;
  guess: RoundPredictionGuess;
  resolved: boolean;
  correct: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export type SubscriptionTier = "free" | "standard" | "premium";
export type PaymentChannel = "native" | "jsapi" | "mock" | "manual";
export type PaymentStatus = "pending" | "paid" | "closed" | "failed";

export interface PaymentOrder {
  id: string;
  outTradeNo: string;
  userId: string;
  targetUserId: string;
  tier: Exclude<SubscriptionTier, "free">;
  channel: PaymentChannel;
  amountFen: number;
  description: string;
  status: PaymentStatus;
  codeUrl?: string;
  prepayId?: string;
  transactionId?: string;
  rawNotify?: unknown;
  paidAt?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionGrant {
  id: string;
  userId: string;
  orderId: string;
  tier: Exclude<SubscriptionTier, "free">;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface AppSetting<TValue = unknown> {
  key: string;
  value: TValue;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingIntent {
  purpose: "guest-upgrade";
  userId: string;
  tier: Exclude<SubscriptionTier, "free">;
  expiresAt: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  title: string;
  classroomId?: string;
  studentLinkId?: string;
  /** H2: incremented on logout/password change to invalidate outstanding JWTs. */
  tokenVersion?: number;
  trialExpiresAt?: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string;
  onboardingCompleted?: number;
  /** A1: ISO timestamp when the user confirmed their email; undefined = unverified. */
  emailVerifiedAt?: string;
}

export interface GuestUpgradeResult {
  redirectTo: "/student";
  billingIntentToken: string;
  billingIntent: BillingIntent;
  user: Pick<
    UserRecord,
    "id" | "email" | "name" | "role" | "trialExpiresAt" | "subscriptionTier"
  >;
}

export interface ProfileRecord {
  userId: string;
  headline: string;
  bio: string;
  metrics: { label: string; value: string }[];
}

export interface Classroom {
  id: string;
  name: string;
  region: string;
  teacherId: string;
  challengeTheme: string;
  schoolRank: number;
}

export interface InviteCode {
  id: string;
  code: string;
  role: Role;
  classroomId?: string;
  studentLinkId?: string;
  label: string;
  createdBy: string;
  usesRemaining: number;
  expiresAt: string;
}

export interface Assignment {
  id: string;
  classroomId: string;
  title: string;
  brief: string;
  difficulty: "基础" | "策略" | "联赛";
  dueLabel: string;
  createdBy: string;
  createdAt: string;
}

export interface StudentParentLink {
  id: string;
  studentUserId: string;
  parentUserId: string;
  bondCode: string;
}

/**
 * Family group membership (Option B): a Premium owner (parent) hosts up to
 * features.maxStudents students who inherit Premium while the owner is active.
 * The group is identified by its ownerUserId.
 */
export interface FamilyMember {
  id: string;
  ownerUserId: string;
  studentUserId: string;
  createdAt: string;
}

/** A weekly parent-report digest row built for the Premium family email cron. */
export interface FamilyDigest {
  ownerEmail: string;
  ownerName: string;
  studentName: string;
  netWorth: number;
  round: number;
  persona: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  classroomId: string;
  netWorth: number;
  disciplineScore: number;
  rank: number;
}

// ── Financial Power leaderboard (V1) ────────────────────────────────────────
export type RankVisibility = "public" | "school_only" | "hidden";
export type RankPeriod = "weekly" | "monthly" | "season";

/** Self-input school, deduped per city (decision 2: no classroom binding). */
export interface School {
  id: string;
  name: string;
  normalizedName: string;
  provinceCode: string;
  cityCode: string;
  status: "approved" | "pending" | "merged";
  mergedInto?: string;
  createdBy?: string;
  createdAt: string;
}

/** Per-user leaderboard identity + privacy. Absent until onboarding done. */
export interface RankProfile {
  userId: string;
  provinceCode: string;
  cityCode: string;
  schoolId: string;
  alias: string;
  visibility: RankVisibility;
  /** Guardian consent gate (decision 3): 0 until consented, 1 after. */
  consent: number;
  /** Soft-floor high-water tier within the season (decision 7). */
  lastTier: number;
  /** Season (semester key) that lastTier belongs to; floor resets across seasons. */
  lastTierSeason: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A2: AI-generated behavioral persona derived from a student's real simulation
 * behavior, persisted on `risk_profiles`. Produced and consumed by later tasks
 * (A2b/A2c/A2d/A2e); this is the shared contract.
 */
export interface BehaviorPersona {
  band: "defensive" | "steady" | "balanced" | "growth";
  label: string;        // e.g. "稳健配置者"
  archetype: string;    // short Chinese archetype tag
  summary: string;      // 1–3 sentence behavioral analysis
  evidence: string[];   // behavioral evidence bullets (Chinese)
  nextSteps: string[];  // suggested next actions (Chinese)
  confidence: "low" | "medium" | "high";
}

export interface PowerComponentsRecord {
  riskAdjReturn: number;
  discipline: number;
  drawdown: number;
  learning: number;
  growth: number;
}

export interface LearningProgressRow {
  userId: string;
  moduleKey: string;
  quizPassed: boolean;
  completedAt: string;
}

export interface LearningProgressSummary {
  completed: number;
  total: number;
  completedKeys: string[];
}

/** Computed power for a user in one period bucket. */
export interface LeaderboardSnapshot {
  id: string;
  userId: string;
  period: RankPeriod;
  periodKey: string;
  power: number;
  tier: number;
  netWorth: number;
  components: PowerComponentsRecord;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthReport {
  studentUserId: string;
  parentUserId: string;
  netWorthTrend: number[];
  competencies: { label: string; value: number }[];
  teacherComment: string;
  aiSummary: string;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  meta?: {
    route?: string;
    assetId?: string;
    actionLogId?: string;
    provider?: "remote" | "fallback";
    baseUrl?: string;
    mode?: AiChatMode;
  };
}

export interface AiChatSession {
  id: string;
  userId?: string;
  guestKey?: string;
  title: string;
  mode: AiChatMode;
  messages: AiChatMessage[];
  updatedAt: string;
}

export interface AiChatPageContext {
  route: string;
  role?: Role;
  assetId?: string;
  actionLogId?: string;
}

export interface ExternalMarketSignal {
  key: string;
  label: string;
  code: string;
  region: string;
  currentPrice: number | null;
  changePercent: number;
  source: "tsanghi" | "itick" | "alltick" | "simulation";
  summary: string;
}

export interface AllocationSlice {
  id: string;
  label: string;
  value: number;
  weight: number;
  color: string;
  hint: string;
}

export interface HoldingExposure {
  id: string;
  label: string;
  symbol: string;
  value: number;
  weight: number;
  dayChange: number;
  pnl: number;
  risk: "低" | "中" | "高";
}

export interface AllocationSuggestion {
  id: string;
  label: string;
  tone: "increase" | "trim" | "hold";
  detail: string;
}

export interface PortfolioIntel {
  asOf: string;
  provider: MarketDataProvider;
  regimeLabel: string;
  regimeSummary: string;
  marketNote: string;
  score: number;
  marketSignals: ExternalMarketSignal[];
  allocation: AllocationSlice[];
  targetAllocation: AllocationSlice[];
  holdings: HoldingExposure[];
  suggestions: AllocationSuggestion[];
  coachNote: string;
  coachProvider: "remote" | "fallback";
}

export interface TutorRadarMetric {
  id: string;
  label: string;
  score: number;
  note: string;
}

/** Premium deep-report investor-personality card (see deriveInvestorPersona). */
export interface InvestorPersona {
  label: string;
  summary: string;
}

export interface TutorRadarPayload {
  asOf: string;
  provider: "remote" | "fallback";
  baseUrl?: string;
  summary: string;
  metrics: TutorRadarMetric[];
}

export interface TickerTapeItem {
  // 放宽到 string：美股仍是固定 union 值，新分类(A股/港股/基金)用裸 ticker 作 id。
  symbol: string;
  code: string;
  name: string;
  companyName: string;
  currentPrice: number;
  changePercent: number;
  source: MarketQuoteSource;
  accentColor: string;
  monogram: string;
  imageUrl?: string;
}

export interface MarketKlineCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MarketBoardMetric {
  id: string;
  label: string;
  score: number;
  note: string;
}

export interface MarketBoardStock {
  symbol: string;
  code: string;
  name: string;
  companyName: string;
  currentPrice: number;
  changePercent: number;
  source: MarketQuoteSource;
  score: number;
  summary: string;
  teachingNote: string;
  sector: string;
  sectorGroup: string;
  tags: string[];
  monogram: string;
  accentColor: string;
  miniSeries: number[];
  candles: MarketKlineCandle[];
  metrics: MarketBoardMetric[];
  facts: Array<{ label: string; value: string }>;
  imageUrl?: string;
  currency?: string;
}

export interface MarketBoardSector {
  id: string;
  label: string;
  changePercent: number;
  leadSymbol: string;
}

export interface MarketBoardContentCard {
  id: string;
  variant: "feature" | "brief";
  title: string;
  summary: string;
  sourceLabel: string;
  accentColor: string;
}

export interface MarketCategoryTab {
  id: MarketCategoryId;
  label: string;
  en: string;
  blurb: string;
  // 该分类默认选中标的 id —— 让前端切 Tab 时一次取数、无需先探测。
  defaultSymbol: string;
}

export interface MarketBoardPayload {
  asOf: string;
  provider: MarketDataProvider;
  note: string;
  // 当前分类 + 可切换的分类清单（驱动顶部 Tab）。默认 us 时与历史行为一致。
  category: MarketCategoryId;
  categories: MarketCategoryTab[];
  watchlist: TickerTapeItem[];
  selected: MarketBoardStock;
  marketSummary: Array<{
    symbol: string;
    name: string;
    currentPrice: number;
    changePercent: number;
    score: number;
  }>;
  sectorPerformance: MarketBoardSector[];
  observationNotes: string[];
  contentCards: MarketBoardContentCard[];
}

export interface HistoryRoundSummary {
  round: number;
  theme: string;
  headline: string;
  eventTitle: string;
  eventSignal: EventCard["signal"];
  netWorth: number;
  cash: number;
  savings: number;
  debt: number;
  riskScore: number;
  disciplineScore: number;
  reflection: string;
}

export interface HistoryActionGroupItem {
  id: string;
  type: ActionLog["type"];
  label: string;
  amount: number;
  timestamp: string;
  direction: "inflow" | "outflow" | "neutral";
  impact: string;
}

export interface HistoryActionGroup {
  round: number;
  theme: string;
  headline: string;
  eventTitle: string;
  eventSignal: EventCard["signal"];
  summary: string;
  items: HistoryActionGroupItem[];
}

export interface HistoryHighlight {
  id: string;
  round: number;
  tone: "positive" | "warning" | "neutral";
  title: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
}

export interface HistoryLearningSignal {
  id: string;
  label: string;
  count: number;
  latestRound?: number;
  tone: "observe" | "build" | "protect" | "review";
  detail: string;
}

export interface HistoryReviewInsight {
  summary: string;
  analysis: string[];
  nextSteps: string[];
  provider: "remote" | "fallback";
  baseUrl?: string;
}

export interface HistoryReviewPayload {
  generatedAt: string;
  timeline: HistoryRoundSummary[];
  actionGroups: HistoryActionGroup[];
  metrics: {
    roundsCompleted: number;
    currentNetWorth: number;
    peakNetWorth: number;
    buyCount: number;
    sellCount: number;
    cashActions: number;
    expansionActions: number;
    learningActions: number;
    reviewActions: number;
    maxDrawdown: number;
    stageLabel: string;
    riskRange: [number, number];
    disciplineTrend: number;
  };
  highlights: HistoryHighlight[];
  learningSignals: HistoryLearningSignal[];
  aiReview: HistoryReviewInsight;
}

export interface SimulationState {
  user: Pick<UserRecord, "id" | "name" | "role" | "title">;
  classroom: Classroom;
  run: ScenarioRun;
  market: {
    round: MarketRound;
    assets: Array<
      MarketAsset & {
        currentPrice: number;
        dayChange: number;
      }
    >;
    event: EventCard;
  };
  leaderboard: LeaderboardEntry[];
}
