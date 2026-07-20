export const premiumMotion = {
  ease: {
    standard: "power4.out",
    press: "power2.out",
    chart: "power3.inOut",
    ambient: "sine.inOut",
    reward: "back.out(1.6)",
  },
  duration: {
    press: 0.16,
    hoverIn: 0.3,
    hoverOut: 0.44,
    reveal: 0.82,
    cardReveal: 0.6,
    number: 1.15,
    draw: 1.25,
    bar: 0.9,
    reward: 0.66,
    scene: 0.74,
    viz: 0.95,
    split: 0.9,
    magneticReturn: 0.5,
  },
  lift: {
    card: 6,
    button: 3,
    depth: 6,
  },
  selector: {
    reveal: "[data-motion-reveal]",
    card: "[data-motion-card]",
    button: "[data-motion-button]",
    float: "[data-motion-float]",
    shine: "[data-motion-shine]",
    number: "[data-motion-number]",
    draw: "[data-motion-draw]",
    bar: "[data-motion-bar]",
    reward: "[data-motion-reward]",
    depth: "[data-motion-depth]",
    overlay: "[data-motion-overlay]",
    modal: "[data-motion-modal]",
    drawer: "[data-motion-drawer]",
    scene: "[data-motion-scene]",
    sceneItem: "[data-motion-scene-item]",
    parallax: "[data-motion-parallax]",
    viz: "[data-motion-viz]",
    vizBar: "[data-motion-viz-bar]",
    vizPath: "[data-motion-viz-path]",
    vizPoint: "[data-motion-viz-point]",
    // v2 (ui-motion-upgrade): landing.love-tier primitives.
    split: "[data-motion-split]",
    magnetic: "[data-motion-magnetic]",
    story: "[data-motion-story]",
    storyStep: "[data-motion-story-step]",
  },
} as const;

export type MotionNumberFormat = "currency" | "integer" | "percent" | "plain";

export function formatMotionNumber(value: number, format: MotionNumberFormat, prefix = "", suffix = "") {
  const formatter = new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: format === "percent" ? 1 : 0,
    minimumFractionDigits: 0,
  });

  if (format === "percent") {
    return `${prefix}${formatter.format(value)}%${suffix}`;
  }

  return `${prefix}${formatter.format(value)}${suffix}`;
}
