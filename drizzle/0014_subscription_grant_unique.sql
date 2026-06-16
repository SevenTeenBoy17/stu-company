-- Migration: enforce one subscription grant per order (#3 audit)
-- Created: 2026-06-15
-- Context: fulfillPaymentOrder now row-locks the order (SELECT ... FOR UPDATE);
--          this unique index is the backstop so a concurrent double callback can
--          never insert two grants for the same order. Pre-checked: no duplicate
--          order_ids. Hand-authored because drizzle-kit generate needs a TTY for an
--          unrelated table-resolver prompt on this snapshot. Idempotent (IF EXISTS /
--          IF NOT EXISTS) so it is safe regardless of apply order.
DROP INDEX IF EXISTS "subscription_grants_order_id_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_grants_order_id_unique" ON "subscription_grants" ("order_id");
