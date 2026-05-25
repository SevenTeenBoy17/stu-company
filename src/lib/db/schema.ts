import {
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
  classroomId: varchar("classroom_id", { length: 64 }),
  studentLinkId: varchar("student_link_id", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  userId: varchar("user_id", { length: 64 }).primaryKey(),
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
  teacherId: varchar("teacher_id", { length: 64 }).notNull(),
  challengeTheme: varchar("challenge_theme", { length: 160 }).notNull(),
  schoolRank: integer("school_rank").notNull(),
});

export const inviteCodes = pgTable("invite_codes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  role: roleEnum("role").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  classroomId: varchar("classroom_id", { length: 64 }),
  studentLinkId: varchar("student_link_id", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  usesRemaining: integer("uses_remaining").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const studentParentLinks = pgTable("student_parent_links", {
  id: varchar("id", { length: 64 }).primaryKey(),
  studentUserId: varchar("student_user_id", { length: 64 }).notNull(),
  parentUserId: varchar("parent_user_id", { length: 64 }).notNull(),
  bondCode: varchar("bond_code", { length: 64 }).notNull(),
});

export const scenarioRuns = pgTable("scenario_runs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  classroomId: varchar("classroom_id", { length: 64 }).notNull(),
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
});

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull(),
  round: integer("round").notNull(),
  netWorth: integer("net_worth").notNull(),
  payload: jsonb("payload").notNull(),
});

export const holdings = pgTable("holdings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull(),
  assetId: varchar("asset_id", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull(),
  averageCost: integer("average_cost").notNull(),
});

export const cashLedger = pgTable("cash_ledger", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  amount: integer("amount").notNull(),
  meta: jsonb("meta").notNull(),
});

export const propertyPositions = pgTable("property_positions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull(),
  units: integer("units").notNull(),
  basis: integer("basis").notNull(),
});

export const venturePositions = pgTable("venture_positions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull(),
  stake: integer("stake").notNull(),
  basis: integer("basis").notNull(),
});

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
  classroomId: varchar("classroom_id", { length: 64 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  brief: text("brief").notNull(),
  difficulty: varchar("difficulty", { length: 32 }).notNull(),
  dueLabel: varchar("due_label", { length: 64 }).notNull(),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiSessions = pgTable("ai_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const growthReports = pgTable("growth_reports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  studentUserId: varchar("student_user_id", { length: 64 }).notNull(),
  parentUserId: varchar("parent_user_id", { length: 64 }).notNull(),
  payload: jsonb("payload").notNull(),
});

export const leaderboards = pgTable("leaderboards", {
  id: varchar("id", { length: 64 }).primaryKey(),
  scope: varchar("scope", { length: 32 }).notNull(),
  payload: jsonb("payload").notNull(),
});
