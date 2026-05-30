/**
 * L2: zod schemas for JSONB columns. Anything we read from a JSONB field
 * crosses a boundary where Postgres' type system stops protecting us —
 * a manual SQL edit, a partial migration, or a stale snapshot can land
 * malformed data on disk. Running .safeParse here turns "bad JSONB"
 * into a controlled error instead of a runtime crash in a component.
 */

import { z } from "zod";

// Use loose schemas — only the critical fields are validated and unknown
// fields pass through unchanged. We want corrupted data to surface as a
// boundary error, not to drop optional fields the rest of the app reads.
export const HoldingSchema = z
  .object({
    assetId: z.string(),
    quantity: z.number(),
    averageCost: z.number(),
  })
  .passthrough();

export const ActionLogSchema = z
  .object({
    id: z.string(),
    type: z.enum(["trade", "bank", "property", "venture", "advance", "event"]),
    label: z.string(),
    round: z.number(),
    amount: z.number(),
  })
  .passthrough();

export const PortfolioSnapshotSchema = z
  .object({
    round: z.number(),
    netWorth: z.number(),
    riskScore: z.number(),
    disciplineScore: z.number(),
  })
  .passthrough();

export const EventLogSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    round: z.number(),
  })
  .passthrough();

export const HoldingsArraySchema = z.array(HoldingSchema);
export const ActionLogArraySchema = z.array(ActionLogSchema);
export const PortfolioSnapshotArraySchema = z.array(PortfolioSnapshotSchema);
export const EventLogArraySchema = z.array(EventLogSchema);
