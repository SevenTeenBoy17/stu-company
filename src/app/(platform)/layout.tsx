import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PremiumMotionProvider } from "@/components/shared/premium-motion-provider";
import { getCurrentUser } from "@/lib/session-user";

// M1: single authentication boundary for every (platform)/* route. Pages
// keep their own role check (student vs teacher vs ...) but they can now
// assume `user` is non-null. Adding a new route under this segment
// inherits the redirect-on-anon behaviour for free.
export default async function PlatformRoutesLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/demo?reason=login_required");
  }
  return (
    <>
      <PremiumMotionProvider />
      {children}
    </>
  );
}
