import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { applyActionForUser, getSimulationStateForUser } from "@/lib/store";

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trade"),
    assetId: z.string(),
    side: z.enum(["buy", "sell"]),
    quantity: z.number().positive(),
    orderMode: z.enum(["market", "limit"]),
  }),
  z.object({
    type: z.literal("bank"),
    action: z.enum(["deposit", "withdraw", "loan", "repay"]),
    amount: z.number().positive(),
  }),
  z.object({
    type: z.literal("property"),
    action: z.enum(["buy", "sell"]),
  }),
  z.object({
    type: z.literal("venture"),
    action: z.enum(["invest", "exit"]),
    amount: z.number().positive(),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const body = actionSchema.parse(await request.json());
    applyActionForUser(auth.user.id, body);
    const state = getSimulationStateForUser(auth.user.id);
    return NextResponse.json({ state, message: "操作已生效。" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "操作失败。" },
      { status: 400 },
    );
  }
}
