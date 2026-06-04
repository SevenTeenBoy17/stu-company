/**
 * Per-request RLS context (see docs/rls-enforcement-staging-plan.md).
 *
 * The app connects as `postgres` (rolbypassrls=true), so RLS is inert unless a
 * request drops to a non-bypass role. This module provides that path WITHOUT a
 * big-bang: it ships dark behind RLS_ENFORCE (default off → current owner-bypass
 * behaviour, zero change) and is opt-in per call site.
 *
 * Model (decision: request-level single transaction):
 *   - withUserRls(claims, fn): opens ONE transaction, injects the JWT claims and
 *     `set local role authenticated` (which does NOT bypass RLS), and exposes that
 *     tx to every repo call inside `fn` via AsyncLocalStorage — so the whole
 *     request shares one enforced identity.
 *   - getRequestExecutor(): what a USER-SCOPED repo function should query against
 *     — the active request's enforced tx, else the owner db (default = service).
 *   - getServiceDb(): the trusted, RLS-bypassing connection for system / cron /
 *     admin / auth-bootstrap paths that legitimately span users.
 */
import { AsyncLocalStorage } from "node:async_hooks";

import { sql } from "drizzle-orm";

import { getDb, type RlsClaims } from "@/lib/db/client";
import type { Role } from "@/lib/types";

type Db = NonNullable<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type RequestExecutor = Db | Tx;

interface RlsRequestContext {
  claims: RlsClaims;
  executor: RequestExecutor;
}

const store = new AsyncLocalStorage<RlsRequestContext>();

/**
 * Whether RLS is enforced for user-scoped requests. Read dynamically (not cached)
 * so it can be flipped at runtime and toggled in tests. Off by default: the
 * mechanism is inert until a staging/prod env opts in.
 */
export function rlsEnforceEnabled() {
  return process.env.RLS_ENFORCE === "true";
}

/**
 * Run `fn` as the request's authenticated user. With RLS_ENFORCE on, all DB work
 * inside `fn` (that uses getRequestExecutor) runs under `authenticated` + the
 * caller's claims, so policies are enforced. With it off, `fn` runs against the
 * owner connection unchanged.
 *
 * Use ONLY for user-scoped request handling. System / cron / admin / login-
 * bootstrap work must use getServiceDb() to keep cross-user access.
 */
export async function withUserRls<T>(claims: RlsClaims, fn: () => Promise<T>): Promise<T> {
  const db = getDb();
  // No DATABASE_URL: leave the repo's in-memory fallback path untouched.
  if (!db) return fn();

  if (!rlsEnforceEnabled()) {
    return store.run({ claims, executor: db }, fn);
  }

  return db.transaction(async (tx) => {
    // Claims are set as the connection role (owner) with is_local=true so they
    // survive the role drop and reset at COMMIT/ROLLBACK.
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
    await tx.execute(sql`select set_config('request.jwt.claim.role', ${claims.role}, true)`);
    await tx.execute(
      sql`select set_config('request.jwt.claim.classroomId', ${claims.classroomId ?? ""}, true)`,
    );
    await tx.execute(sql.raw("set local role authenticated"));
    return store.run({ claims, executor: tx }, fn);
  });
}

/**
 * The executor a USER-SCOPED repo function should use: the active request's
 * enforced tx when inside withUserRls, else the owner db (default service path,
 * i.e. today's behaviour). Returns null only when no DB is configured.
 */
export function getRequestExecutor(): RequestExecutor | null {
  return store.getStore()?.executor ?? getDb();
}

/** The trusted, RLS-bypassing connection for system / cron / admin / bootstrap. */
export function getServiceDb() {
  return getDb();
}

/** The current request's claims, if running inside withUserRls (else null). */
export function currentRlsClaims(): RlsClaims | null {
  return store.getStore()?.claims ?? null;
}

/** Build RLS claims from the authenticated user (the result of requireUser). */
export function rlsClaimsForUser(user: {
  id: string;
  role: Role;
  classroomId?: string | null;
}): RlsClaims {
  return { sub: user.id, role: user.role, classroomId: user.classroomId ?? null };
}
