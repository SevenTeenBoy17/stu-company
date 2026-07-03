import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import type { Role } from "@/lib/types";

const COOKIE_NAME = "brown_zone_session";

export interface SessionPayload extends JWTPayload {
  userId: string;
  role: Role;
  email: string;
  classroomId?: string | null;
  /** H2: matched against UserRecord.tokenVersion to support server-side revoke. */
  tv: number;
}

function getSecret() {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[auth] SESSION_SECRET is required in production");
    }
    console.warn("[auth] using insecure dev SESSION_SECRET — never deploy");
    return new TextEncoder().encode("brown-zone-development-secret-do-not-use");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function persistSession(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return token;
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSession() {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;

  if (!cookie) {
    return null;
  }

  try {
    const result = await jwtVerify<SessionPayload>(cookie, getSecret(), { algorithms: ["HS256"] });
    return result.payload;
  } catch {
    return null;
  }
}
