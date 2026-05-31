import { NextResponse } from "next/server";

import { verifyEmailVerificationToken } from "@/lib/email-verification";
import { markEmailVerified } from "@/lib/db/repo";

/**
 * A1: confirms a user's email from a signed link. Designed for a GET (the user
 * clicks a link), so it redirects to a friendly page with a status flag rather
 * than returning JSON.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  const result = await verifyEmailVerificationToken(token);
  if (!result) {
    return NextResponse.redirect(new URL("/demo?verify=invalid", url.origin));
  }

  try {
    await markEmailVerified(result.userId);
    return NextResponse.redirect(new URL("/demo?verify=success", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/demo?verify=error", url.origin));
  }
}
