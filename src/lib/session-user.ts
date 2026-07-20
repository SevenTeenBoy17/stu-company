import { cache } from "react";

import { readSession } from "@/lib/auth";
import { applyFamilyEntitlement, findUserById } from "@/lib/db/repo";

// M2: per-request memo so layout/page/components on the same render share
// one DB round-trip instead of issuing N findUserById calls. React.cache is
// scoped to a single Server Component render tree.
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;

  // Keep page-level auth aligned with API guards. If an admin resets a
  // password/email, tokenVersion changes and old page cookies must stop
  // resolving to a valid user even before an API call is made.
  if ((user.tokenVersion ?? 0) !== (session.tv ?? 0)) return null;

  // itest10 #7: mirror requireUser (api-guard.ts) — a student inheriting Premium
  // from a family owner must resolve as Premium in Server Components too, or the
  // SSR dashboard shows a paid family student the red "trial expired" banner.
  // No-op for non-students.
  return applyFamilyEntitlement(user);
});
