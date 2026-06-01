-- Migration: add WeChat monthly-pass payment persistence
-- Created: 2026-05-28
-- Context: Brown Zone 15 RMB/month manual renewal via WeChat Native/JSAPI.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_expires_at" timestamp;

CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "out_trade_no" varchar(96) NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "target_user_id" varchar(64) NOT NULL,
  "tier" varchar(20) NOT NULL,
  "channel" varchar(16) NOT NULL,
  "amount_fen" integer NOT NULL,
  "description" varchar(180) NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "code_url" text,
  "prepay_id" varchar(128),
  "transaction_id" varchar(128),
  "raw_notify" jsonb,
  "paid_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payment_orders_out_trade_no_unique" UNIQUE("out_trade_no")
);

CREATE TABLE IF NOT EXISTS "subscription_grants" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "order_id" varchar(64) NOT NULL,
  "tier" varchar(20) NOT NULL,
  "starts_at" timestamp NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_target_user_id_users_id_fk"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "subscription_grants" ADD CONSTRAINT "subscription_grants_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "subscription_grants" ADD CONSTRAINT "subscription_grants_order_id_payment_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "payment_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "payment_orders_user_id_idx" ON "payment_orders" ("user_id");
CREATE INDEX IF NOT EXISTS "payment_orders_target_user_id_idx" ON "payment_orders" ("target_user_id");
CREATE INDEX IF NOT EXISTS "payment_orders_out_trade_no_idx" ON "payment_orders" ("out_trade_no");
CREATE INDEX IF NOT EXISTS "payment_orders_status_idx" ON "payment_orders" ("status");
CREATE INDEX IF NOT EXISTS "subscription_grants_user_id_idx" ON "subscription_grants" ("user_id");
CREATE INDEX IF NOT EXISTS "subscription_grants_order_id_idx" ON "subscription_grants" ("order_id");
