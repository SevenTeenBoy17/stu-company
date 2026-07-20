import type { ReactNode } from "react";

import { DeferredMotionProvider } from "@/components/shared/deferred-motion-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    // ui-v2 polish：公开站浅色底铺一层近不可见的暖纸纹（texture-paper-light，37KB）。
    // 审查 #8：不用 bg-fixed——iOS Safari 不支持（静默降级不一致）且桌面端触发
    // 滚动全视口重绘；默认 scroll 附着对细纹理观感等价。
    <div
      className="min-h-screen bg-center"
      style={{ backgroundImage: "url(/brand/v2/texture-paper-light.webp)" }}
      data-site-shell="true"
    >
      <DeferredMotionProvider />
      <SiteHeader />
      <div>{children}</div>
      <SiteFooter />
    </div>
  );
}
