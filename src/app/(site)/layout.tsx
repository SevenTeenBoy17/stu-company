import type { ReactNode } from "react";

import { DeferredMotionProvider } from "@/components/shared/deferred-motion-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" data-site-shell="true">
      <DeferredMotionProvider />
      <SiteHeader />
      <div>{children}</div>
      <SiteFooter />
    </div>
  );
}
