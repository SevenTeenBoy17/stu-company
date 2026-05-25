CREATE TYPE "public"."role" AS ENUM('student', 'teacher', 'parent', 'admin');--> statement-breakpoint
CREATE TABLE "ai_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"classroom_id" varchar(64) NOT NULL,
	"title" varchar(160) NOT NULL,
	"brief" text NOT NULL,
	"difficulty" varchar(32) NOT NULL,
	"due_label" varchar(64) NOT NULL,
	"created_by" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_ledger" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"amount" integer NOT NULL,
	"meta" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"region" varchar(120) NOT NULL,
	"teacher_id" varchar(64) NOT NULL,
	"challenge_theme" varchar(160) NOT NULL,
	"school_rank" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_cards" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"title" varchar(160) NOT NULL,
	"category" varchar(32) NOT NULL,
	"signal" varchar(16) NOT NULL,
	"description" text NOT NULL,
	"coaching_cue" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_reports" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"student_user_id" varchar(64) NOT NULL,
	"parent_user_id" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"asset_id" varchar(64) NOT NULL,
	"quantity" integer NOT NULL,
	"average_cost" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"role" "role" NOT NULL,
	"label" varchar(160) NOT NULL,
	"classroom_id" varchar(64),
	"student_link_id" varchar(64),
	"created_by" varchar(64) NOT NULL,
	"uses_remaining" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "leaderboards" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"scope" varchar(32) NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"round" integer NOT NULL,
	"net_worth" integer NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"title" varchar(120) NOT NULL,
	"headline" text NOT NULL,
	"bio" text NOT NULL,
	"metrics" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_positions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"units" integer NOT NULL,
	"basis" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_runs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"classroom_id" varchar(64) NOT NULL,
	"scenario_name" varchar(160) NOT NULL,
	"current_round" integer NOT NULL,
	"total_rounds" integer NOT NULL,
	"cash" integer NOT NULL,
	"savings" integer NOT NULL,
	"debt" integer NOT NULL,
	"property_units" integer NOT NULL,
	"property_basis" integer NOT NULL,
	"venture_stake" integer NOT NULL,
	"venture_basis" integer NOT NULL,
	"holdings" jsonb NOT NULL,
	"event_history" jsonb NOT NULL,
	"action_log" jsonb NOT NULL,
	"snapshots" jsonb NOT NULL,
	"last_insight" text
);
--> statement-breakpoint
CREATE TABLE "student_parent_links" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"student_user_id" varchar(64) NOT NULL,
	"parent_user_id" varchar(64) NOT NULL,
	"bond_code" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"classroom_id" varchar(64),
	"student_link_id" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "venture_positions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"stake" integer NOT NULL,
	"basis" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_ledger" ADD CONSTRAINT "cash_ledger_run_id_scenario_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scenario_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_reports" ADD CONSTRAINT "growth_reports_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_reports" ADD CONSTRAINT "growth_reports_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_run_id_scenario_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scenario_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_student_link_id_student_parent_links_id_fk" FOREIGN KEY ("student_link_id") REFERENCES "public"."student_parent_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_run_id_scenario_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scenario_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_positions" ADD CONSTRAINT "property_positions_run_id_scenario_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scenario_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_parent_links" ADD CONSTRAINT "student_parent_links_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_parent_links" ADD CONSTRAINT "student_parent_links_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_student_link_id_student_parent_links_id_fk" FOREIGN KEY ("student_link_id") REFERENCES "public"."student_parent_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_positions" ADD CONSTRAINT "venture_positions_run_id_scenario_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scenario_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_sessions_user_id_idx" ON "ai_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assignments_classroom_id_idx" ON "assignments" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "assignments_created_by_idx" ON "assignments" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "cash_ledger_run_id_idx" ON "cash_ledger" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "cash_ledger_type_idx" ON "cash_ledger" USING btree ("type");--> statement-breakpoint
CREATE INDEX "classrooms_teacher_id_idx" ON "classrooms" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "growth_reports_student_user_id_idx" ON "growth_reports" USING btree ("student_user_id");--> statement-breakpoint
CREATE INDEX "growth_reports_parent_user_id_idx" ON "growth_reports" USING btree ("parent_user_id");--> statement-breakpoint
CREATE INDEX "holdings_run_id_idx" ON "holdings" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "holdings_asset_id_idx" ON "holdings" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "invite_codes_classroom_id_idx" ON "invite_codes" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "invite_codes_student_link_id_idx" ON "invite_codes" USING btree ("student_link_id");--> statement-breakpoint
CREATE INDEX "invite_codes_created_by_idx" ON "invite_codes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "leaderboards_scope_idx" ON "leaderboards" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_run_id_idx" ON "portfolio_snapshots" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "property_positions_run_id_idx" ON "property_positions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "scenario_runs_user_id_idx" ON "scenario_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scenario_runs_classroom_id_idx" ON "scenario_runs" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "student_parent_links_student_user_id_idx" ON "student_parent_links" USING btree ("student_user_id");--> statement-breakpoint
CREATE INDEX "student_parent_links_parent_user_id_idx" ON "student_parent_links" USING btree ("parent_user_id");--> statement-breakpoint
CREATE INDEX "student_parent_links_bond_code_idx" ON "student_parent_links" USING btree ("bond_code");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_classroom_id_idx" ON "users" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "users_student_link_id_idx" ON "users" USING btree ("student_link_id");--> statement-breakpoint
CREATE INDEX "venture_positions_run_id_idx" ON "venture_positions" USING btree ("run_id");