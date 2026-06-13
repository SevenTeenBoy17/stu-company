import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" data-site-shell="true">
      <SiteHeader />
      <div>{children}</div>
      <SiteFooter />
    </div>
  );
}
