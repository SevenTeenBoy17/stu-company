import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["student", "teacher", "parent", "admin"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  classroomId: varchar("classroom_id", { length: 64 }).references((): AnyPgColumn => classrooms.id),
  studentLinkId: varchar("student_link_id", { length: 64 }).references(
    (): AnyPgColumn => studentParentLinks.id,
  ),
  // H2: bumped on logout / password change to invalidate outstanding JWTs.
  tokenVersion: integer("token_version").notNull().default(0),
  trialExpiresAt: timestamp("trial_expires_at"),
  subscriptionTier: varchar("subscription_tier", { length: 20 }).notNull().default("free"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  onboardingCompleted: integer("onboarding_completed").notNull().default(0),
  // A1: null until the user confirms their email. Capability is tracked now;
  // enforcement (gating AI behind verification) is deferred until an email
  // provider is wired so unverified real users are not locked out.
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("users_role_idx").on(table.role),
  index("users_classroom_id_idx").on(table.classroomId),
  index("users_student_link_id_idx").on(table.studentLinkId),
]);

export const paymentOrders = pgTable("payment_orders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  outTradeNo: varchar("out_trade_no", { length: 96 }).notNull().unique(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  targetUserId: varchar("target_user_id", { length: 64 }).notNull().references(() => users.id),
  tier: varchar("tier", { length: 20 }).notNull(),
  channel: varchar("channel", { length: 16 }).notNull(),
  amountFen: integer("amount_fen").notNull(),
  description: varchar("description", { length: 180 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  codeUrl: text("code_url"),
  prepayId: varchar("prepay_id", { length: 128 }),
  transactionId: varchar("transaction_id", { length: 128 }),
  rawNotify: jsonb("raw_notify"),
  paidAt: timestamp("paid_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("payment_orders_user_id_idx").on(table.userId),
  index("payment_orders_target_user_id_idx").on(table.targetUserId),
  index("payment_orders_out_trade_no_idx").on(table.outTradeNo),
  index("payment_orders_status_idx").on(table.status),
]);

export const subscriptionGrants = pgTable("subscription_grants", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  orderId: varchar("order_id", { length: 64 }).notNull().references(() => paymentOrders.id),
  tier: varchar("tier", { length: 20 }).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("subscription_grants_user_id_idx").on(table.userId),
  index("subscription_grants_order_id_idx").on(table.orderId),
]);

export const profiles = pgTable("profiles", {
  userId: varchar("user_id", { length: 64 }).primaryKey().references(() => users.id),
  name: varchar("name", { length: 120 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  headline: text("headline").notNull(),
  bio: text("bio").notNull(),
  metrics: jsonb("metrics").$type<Array<{ label: string; value: string }>>().notNull(),
});

export const classrooms = pgTable("classrooms", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  region: varchar("region", { length: 120 }).notNull(),
  teacherId: varchar("teacher_id", { length: 64 }).notNull().references((): AnyPgColumn => users.id),
  challengeTheme: varchar("challenge_theme", { length: 160 }).notNull(),
  schoolRank: integer("school_rank").notNull(),
}, (table) => [
  index("classrooms_teacher_id_idx").on(table.teacherId),
]);

export const inviteCodes = pgTable("invite_codes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  role: roleEnum("role").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  classroomId: varchar("classroom_id", { length: 64 }).references(() => classrooms.id),
  studentLinkId: varchar("student_link_id", { length: 64 }).references(
    (): AnyPgColumn => studentParentLinks.id,
  ),
  createdBy: varchar("created_by", { length: 64 }).notNull().references(() => users.id),
  usesRemaining: integer("uses_remaining").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  index("invite_codes_classroom_id_idx").on(table.classroomId),
  index("invite_codes_student_link_id_idx").on(table.studentLinkId),
  index("invite_codes_created_by_idx").on(table.createdBy),
]);

export const studentParentLinks = pgTable("student_parent_links", {
  id: varchar("id", { length: 64 }).primaryKey(),
  studentUserId: varchar("student_user_id", { length: 64 }).notNull().references(() => users.id),
  parentUserId: varchar("parent_user_id", { length: 64 }).notNull().references(() => users.id),
  bondCode: varchar("bond_code", { length: 64 }).notNull(),
}, (table) => [
  index("student_parent_links_student_user_id_idx").on(table.studentUserId),
  index("student_parent_links_parent_user_id_idx").on(table.parentUserId),
  index("student_parent_links_bond_code_idx").on(table.bondCode),
]);

// Family group membership (Option B). A student belongs to at most one family
// (studentUserId unique); the group is identified by ownerUserId (the parent).
export const familyMembers = pgTable("family_members", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerUserId: varchar("owner_user_id", { length: 64 }).notNull().references(() => users.id),
  studentUserId: varchar("student_user_id", { length: 64 }).notNull().unique().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("family_members_owner_user_id_idx").on(table.ownerUserId),
]);

export const scenarioRuns = pgTable("scenario_runs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  classroomId: varchar("classroom_id", { length: 64 }).notNull().references(() => classrooms.id),
  scenarioName: varchar("scenario_name", { length: 160 }).notNull(),
  currentRound: integer("current_round").notNull(),
  totalRounds: integer("total_rounds").notNull(),
  cash: integer("cash").notNull(),
  savings: integer("savings").notNull(),
  debt: integer("debt").notNull(),
  propertyUnits: integer("property_units").notNull(),
  propertyBasis: integer("property_basis").notNull(),
  ventureStake: integer("venture_stake").notNull(),
  ventureBasis: integer("venture_basis").notNull(),
  holdings: jsonb("holdings").notNull(),
  eventHistory: jsonb("event_history").notNull(),
  actionLog: jsonb("action_log").notNull(),
  snapshots: jsonb("snapshots").notNull(),
  lastInsight: text("last_insight"),
  // Seeded random-event engine (src/lib/event-engine.ts). Nullable for legacy
  // runs created before the engine existed — those fall back to the fixed script.
  seed: integer("seed"),
  eventTimeline: jsonb("event_timeline"),
  // Materialized latest net worth so the weekly season leaderboard can rank in SQL.
  netWorth: integer("net_worth"),
}, (table) => [
  index("scenario_runs_user_id_idx").on(table.userId),
  index("scenario_runs_classroom_id_idx").on(table.classroomId),
  // Weekly season leaderboard: filter by seed, rank by net worth — composite index
  // serves the ORDER BY net_worth DESC LIMIT N top-N query.
  index("scenario_runs_seed_net_worth_idx").on(table.seed, table.netWorth),
]);

// H6 — zombie tables (portfolio_snapshots, holdings, cash_ledger,
// property_positions, venture_positions, event_cards, leaderboards) were
// defined but never written to. Their data lives in scenario_runs JSONB
// columns. Removed from schema; drizzle/0001_drop_zombie_tables.sql drops
// them from the database.

export const assignments = pgTable("assignments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  classroomId: varchar("classroom_id", { length: 64 }).notNull().references(() => classrooms.id),
  title: varchar("title", { length: 160 }).notNull(),
  brief: text("brief").notNull(),
  difficulty: varchar("difficulty", { length: 32 }).notNull(),
  dueLabel: varchar("due_label", { length: 64 }).notNull(),
  createdBy: varchar("created_by", { length: 64 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("assignments_classroom_id_idx").on(table.classroomId),
  index("assignments_created_by_idx").on(table.createdBy),
]);

export const aiSessions = pgTable("ai_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ai_sessions_user_id_idx").on(table.userId),
]);

// H7: messages live in their own table so appends don't rewrite the whole
// session blob. Cascade-deletes when the parent session goes.
export const aiMessages = pgTable("ai_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("session_id", { length: 64 })
    .notNull()
    .references(() => aiSessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 16 }).notNull(),
  text: text("text").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ai_messages_session_created_idx").on(table.sessionId, table.createdAt),
]);

export const growthReports = pgTable("growth_reports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  studentUserId: varchar("student_user_id", { length: 64 }).notNull().references(() => users.id),
  parentUserId: varchar("parent_user_id", { length: 64 }).notNull().references(() => users.id),
  payload: jsonb("payload").notNull(),
}, (table) => [
  // H8: a student has exactly one current growth report; enforce so the
  // syncGrowthReportForStudent race can use onConflictDoUpdate.
  uniqueIndex("growth_reports_student_unique").on(table.studentUserId),
  index("growth_reports_parent_user_id_idx").on(table.parentUserId),
]);

// ── Financial Power leaderboard (V1) ────────────────────────────────────────
// Self-input schools (decision 2: no classroom binding). Deduped per city on
// the normalized name (src/lib/leaderboard/school-normalize.ts). New rows are
// approved by default; `pending`/`merged` exist for moderation without a code
// change.
export const schools = pgTable("schools", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  normalizedName: varchar("normalized_name", { length: 160 }).notNull(),
  provinceCode: varchar("province_code", { length: 8 }).notNull(),
  cityCode: varchar("city_code", { length: 8 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("approved"),
  mergedInto: varchar("merged_into", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // dedup key (city_code, normalized_name) — findOrCreateSchool relies on this.
  uniqueIndex("schools_city_normalized_unique").on(table.cityCode, table.normalizedName),
  index("schools_city_idx").on(table.cityCode),
  index("schools_province_idx").on(table.provinceCode),
]);

// Per-user leaderboard identity + privacy. A row exists only after the required
// onboarding (school + region, decision 2) — its absence means "not yet ranked".
// Kept separate from the marketing `profiles` table on purpose.
export const rankProfiles = pgTable("rank_profiles", {
  userId: varchar("user_id", { length: 64 }).primaryKey().references(() => users.id),
  provinceCode: varchar("province_code", { length: 8 }).notNull(),
  cityCode: varchar("city_code", { length: 8 }).notNull(),
  schoolId: varchar("school_id", { length: 64 }).notNull().references((): AnyPgColumn => schools.id),
  // Public nickname (decision 3: real name is never shown on boards).
  alias: varchar("alias", { length: 40 }).notNull(),
  // public | school_only | hidden (src/lib/leaderboard/ranking.ts).
  visibility: varchar("visibility", { length: 16 }).notNull().default("public"),
  // Guardian consent gate for minors (decision 3). 0 until consented.
  consent: integer("consent").notNull().default(0),
  // Soft floor (decision 7): highest tier reached this season; a minor never
  // drops below it within the season.
  lastTier: integer("last_tier").notNull().default(0),
  // The season (semester key) lastTier belongs to, so the floor resets across
  // seasons. Empty until the first recompute.
  lastTierSeason: varchar("last_tier_season", { length: 32 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("rank_profiles_school_idx").on(table.schoolId),
  index("rank_profiles_city_idx").on(table.cityCode),
  index("rank_profiles_province_idx").on(table.provinceCode),
]);

// Computed power per user per period. Identity/scope (school, region, alias,
// visibility) come from rank_profiles at read time so a visibility change takes
// effect immediately. `tier` is the soft-floored tier at snapshot time.
export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  period: varchar("period", { length: 16 }).notNull(),
  periodKey: varchar("period_key", { length: 32 }).notNull(),
  power: integer("power").notNull(),
  tier: integer("tier").notNull(),
  netWorth: integer("net_worth").notNull(),
  components: jsonb("components")
    .$type<{ riskAdjReturn: number; discipline: number; drawdown: number; learning: number; growth: number }>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // one snapshot per user per period bucket — recompute uses onConflictDoUpdate.
  uniqueIndex("leaderboard_snapshots_user_period_unique").on(
    table.userId,
    table.period,
    table.periodKey,
  ),
  // ranking query: filter by (period, period_key), order by power desc.
  index("leaderboard_snapshots_rank_idx").on(table.period, table.periodKey, table.power),
]);
