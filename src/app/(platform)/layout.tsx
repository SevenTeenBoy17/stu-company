import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PremiumMotionProvider } from "@/components/shared/premium-motion-provider";
import { getCurrentUser } from "@/lib/session-user";

// M1: single authentication boundary for every (platform)/* route. Pages
// keep their own role check (student vs teacher vs ...) but they can now
// assume `user` is non-null. Adding a new route under this segment
// inherits the redirect-on-anon behaviour for free.
// itest11：auth=login 让 /demo 直接弹登录窗。Server Component layout 拿不到
// pathname，回跳 next 由各页面自己携带（见各 page.tsx 的静态路由）。
export default async function PlatformRoutesLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/demo?auth=login&reason=login_required");
  }
  return (
    <>
      <PremiumMotionProvider />
      {children}
    </>
  );
}
