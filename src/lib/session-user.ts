import { cache } from "react";

import { readSession } from "@/lib/auth";
import { findUserById } from "@/lib/db/repo";

// M2: per-request memo so layout/page/components on the same render share
// one DB round-trip instead of issuing N findUserById calls. React.cache is
// scoped to a single Server Component render tree.
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  return await findUserById(session.userId);
});
