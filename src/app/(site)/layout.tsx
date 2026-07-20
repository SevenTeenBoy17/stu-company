import type { ReactNode } from "react";

import { DeferredMotionProvider } from "@/components/shared/deferred-motion-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    // ui-v2：曾试铺 texture-paper-light 全站纸纹，实拍撤销——生成图带钢笔/植物阴影
    // 等摄影元素，平铺后在留白区露出异物与接缝，伤害版式（视觉验收 final-story-act1）。
    // 「近不可见纹理」不适合用生成图承载；深色行情带的收敛底纹（近黑）保留。
    <div className="min-h-screen" data-site-shell="true">
      <DeferredMotionProvider />
      <SiteHeader />
      <div>{children}</div>
      <SiteFooter />
    </div>
  );
}
