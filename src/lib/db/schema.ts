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
}, (table) => [
  index("scenario_runs_user_id_idx").on(table.userId),
  index("scenario_runs_classroom_id_idx").on(table.classroomId),
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
