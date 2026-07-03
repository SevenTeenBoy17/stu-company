"use client";

import dynamic from "next/dynamic";

/**
 * PERF-BUNDLE-1: on the public (site) pages, load the GSAP-based motion provider
 * off the first-load critical path (ssr:false dynamic import) so GSAP + ScrollTrigger
 * are not in the marketing bundle. The `deferred` flag tells the provider to leave
 * above-the-fold reveals visible, so the hero/LCP never flashes while the chunk loads;
 * below-the-fold sections still scroll-reveal once it does. Authenticated (platform)
 * pages keep the provider eager for their full premium-motion first paint.
 */
const PremiumMotionProvider = dynamic(
  () => import("@/components/shared/premium-motion-provider").then((mod) => mod.PremiumMotionProvider),
  { ssr: false },
);

export function DeferredMotionProvider() {
  return <PremiumMotionProvider deferred />;
}
