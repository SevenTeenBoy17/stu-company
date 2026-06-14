export const premiumMotion = {
  ease: {
    standard: "power3.out",
    press: "power2.out",
    chart: "power2.inOut",
    ambient: "sine.inOut",
    reward: "back.out(1.45)",
  },
  duration: {
    press: 0.16,
    hoverIn: 0.28,
    hoverOut: 0.36,
    reveal: 0.72,
    cardReveal: 0.52,
    number: 0.95,
    draw: 1.05,
    bar: 0.78,
    reward: 0.62,
    scene: 0.64,
    viz: 0.82,
  },
  lift: {
    card: 4,
    button: 2,
    depth: 5,
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
