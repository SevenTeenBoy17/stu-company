import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("users_role_idx").on(table.role),
  index("users_classroom_id_idx").on(table.classroomId),
  index("users_student_link_id_idx").on(table.studentLinkId),
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
}, (table) => [
  index("scenario_runs_user_id_idx").on(table.userId),
  index("scenario_runs_classroom_id_idx").on(table.classroomId),
]);

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull().references(() => scenarioRuns.id),
  round: integer("round").notNull(),
  netWorth: integer("net_worth").notNull(),
  payload: jsonb("payload").notNull(),
}, (table) => [
  index("portfolio_snapshots_run_id_idx").on(table.runId),
]);

export const holdings = pgTable("holdings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull().references(() => scenarioRuns.id),
  assetId: varchar("asset_id", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull(),
  averageCost: integer("average_cost").notNull(),
}, (table) => [
  index("holdings_run_id_idx").on(table.runId),
  index("holdings_asset_id_idx").on(table.assetId),
]);

export const cashLedger = pgTable("cash_ledger", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull().references(() => scenarioRuns.id),
  type: varchar("type", { length: 32 }).notNull(),
  amount: integer("amount").notNull(),
  meta: jsonb("meta").notNull(),
}, (table) => [
  index("cash_ledger_run_id_idx").on(table.runId),
  index("cash_ledger_type_idx").on(table.type),
]);

export const propertyPositions = pgTable("property_positions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull().references(() => scenarioRuns.id),
  units: integer("units").notNull(),
  basis: integer("basis").notNull(),
}, (table) => [
  index("property_positions_run_id_idx").on(table.runId),
]);

export const venturePositions = pgTable("venture_positions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull().references(() => scenarioRuns.id),
  stake: integer("stake").notNull(),
  basis: integer("basis").notNull(),
}, (table) => [
  index("venture_positions_run_id_idx").on(table.runId),
]);

export const eventCards = pgTable("event_cards", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  signal: varchar("signal", { length: 16 }).notNull(),
  description: text("description").notNull(),
  coachingCue: text("coaching_cue").notNull(),
});

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
}, (table) => [
  index("ai_sessions_user_id_idx").on(table.userId),
]);

export const growthReports = pgTable("growth_reports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  studentUserId: varchar("student_user_id", { length: 64 }).notNull().references(() => users.id),
  parentUserId: varchar("parent_user_id", { length: 64 }).notNull().references(() => users.id),
  payload: jsonb("payload").notNull(),
}, (table) => [
  index("growth_reports_student_user_id_idx").on(table.studentUserId),
  index("growth_reports_parent_user_id_idx").on(table.parentUserId),
]);

export const leaderboards = pgTable("leaderboards", {
  id: varchar("id", { length: 64 }).primaryKey(),
  scope: varchar("scope", { length: 32 }).notNull(),
  payload: jsonb("payload").notNull(),
}, (table) => [
  index("leaderboards_scope_idx").on(table.scope),
]);
