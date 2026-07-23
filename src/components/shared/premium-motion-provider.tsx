"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { usePathname } from "next/navigation";

import { formatMotionNumber, premiumMotion, type MotionNumberFormat } from "@/lib/motion-system";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// Scroll-reveal + conditionally-rendered elements legitimately mean some per-page
// animations target nodes that aren't mounted at run time. GSAP's missing-target
// warnings are benign here (it no-ops) but flood the console and mask real errors.
gsap.config({ nullTargetWarn: false });

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function motionDelay(element: HTMLElement) {
  const raw = Number(element.dataset.motionDelay ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

function addLiftInteraction(element: HTMLElement, lift: number) {
  const enter = () => {
    gsap.to(element, {
      y: -lift,
      scale: 1.01,
      duration: premiumMotion.duration.hoverIn,
      ease: premiumMotion.ease.standard,
      overwrite: "auto",
    });
  };
  const leave = () => {
    gsap.to(element, {
      x: 0,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      duration: premiumMotion.duration.hoverOut,
      ease: premiumMotion.ease.standard,
      overwrite: "auto",
    });
  };
  const down = () => {
    gsap.to(element, {
      scale: 0.985,
      duration: premiumMotion.duration.press,
      ease: premiumMotion.ease.press,
      overwrite: "auto",
    });
  };
  const up = () => {
    gsap.to(element, {
      scale: 1.01,
      duration: 0.2,
      ease: premiumMotion.ease.press,
      overwrite: "auto",
    });
  };

  element.addEventListener("pointerenter", enter);
  element.addEventListener("pointerleave", leave);
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", leave);

  return () => {
    element.removeEventListener("pointerenter", enter);
    element.removeEventListener("pointerleave", leave);
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointercancel", leave);
    gsap.killTweensOf(element);
  };
}

function addDepthInteraction(element: HTMLElement) {
  const rotateXTo = gsap.quickTo(element, "rotateX", {
    duration: 0.38,
    ease: premiumMotion.ease.standard,
  });
  const rotateYTo = gsap.quickTo(element, "rotateY", {
    duration: 0.38,
    ease: premiumMotion.ease.standard,
  });
  const yTo = gsap.quickTo(element, "y", {
    duration: 0.38,
    ease: premiumMotion.ease.standard,
  });

  gsap.set(element, {
    transformPerspective: 900,
    transformOrigin: "center center",
  });

  const move = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
    const py = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
    rotateYTo(px * 5);
    rotateXTo(py * -4);
    yTo(-premiumMotion.lift.depth);
  };

  const leave = () => {
    rotateXTo(0);
    rotateYTo(0);
    yTo(0);
  };

  element.addEventListener("pointermove", move);
  element.addEventListener("pointerleave", leave);
  element.addEventListener("pointercancel", leave);

  return () => {
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerleave", leave);
    element.removeEventListener("pointercancel", leave);
    gsap.killTweensOf(element);
  };
}

function animateNumber(element: HTMLElement, reduceMotion: boolean) {
  const value = Number(element.dataset.motionValue);
  if (!Number.isFinite(value)) return;

  // 交付审查 P1：textContent 覆写会把 React 管理的元素子节点（如 MoneyText 的
  // span）摘出 DOM，此后 React 重渲染只更新已脱离文档的节点，屏上数字永久冻结
  // 在首次动画值。协议收紧为「data-motion-number 节点只允许纯文本子节点」（与
  // StatCard 一致）：含元素子节点时跳过 count-up，保留 SSR 文本与 React 掌控权。
  if (element.childElementCount > 0) return;

  const format = (element.dataset.motionFormat ?? "integer") as MotionNumberFormat;
  const prefix = element.dataset.motionPrefix ?? "";
  const suffix = element.dataset.motionSuffix ?? "";
  const finalText = formatMotionNumber(value, format, prefix, suffix);

  if (reduceMotion) {
    element.textContent = finalText;
    return;
  }

  const state = { value: 0 };
  gsap.fromTo(
    state,
    { value: 0 },
    {
      value,
      duration: premiumMotion.duration.number,
      delay: motionDelay(element),
      ease: premiumMotion.ease.standard,
      onUpdate: () => {
        element.textContent = formatMotionNumber(state.value, format, prefix, suffix);
      },
      onComplete: () => {
        element.textContent = finalText;
      },
      overwrite: "auto",
    },
  );
}

function animateDraw(element: SVGGeometryElement, reduceMotion: boolean) {
  const length = element.getTotalLength();
  gsap.set(element, { strokeDasharray: length, strokeDashoffset: reduceMotion ? 0 : length });
  if (reduceMotion) return;
  gsap.to(element, {
    strokeDashoffset: 0,
    duration: premiumMotion.duration.draw,
    delay: motionDelay(element as unknown as HTMLElement),
    ease: premiumMotion.ease.chart,
    overwrite: "auto",
  });
}

function animateBar(element: HTMLElement, reduceMotion: boolean) {
  const transformOrigin = element.dataset.motionOrigin ?? "left center";
  gsap.set(element, { transformOrigin, scaleX: reduceMotion ? 1 : 0 });
  if (reduceMotion) return;
  gsap.to(element, {
    scaleX: 1,
    duration: premiumMotion.duration.bar,
    delay: motionDelay(element),
    ease: premiumMotion.ease.standard,
    overwrite: "auto",
  });
}

function motionNumber(element: HTMLElement, key: string, fallback: number) {
  const raw = Number(element.dataset[key]);
  return Number.isFinite(raw) ? raw : fallback;
}

function addSceneTimeline(scene: HTMLElement) {
  const items = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.sceneItem, scene);
  if (!items.length) return () => {};

  gsap.set(items, { autoAlpha: 0, y: 24, scale: 0.985 });
  const timeline = gsap.timeline({
    defaults: {
      duration: premiumMotion.duration.scene,
      ease: premiumMotion.ease.standard,
    },
    scrollTrigger: {
      trigger: scene,
      start: "clamp(top 78%)",
      end: "clamp(bottom 22%)",
      once: true,
    },
  });

  timeline.to(items, {
    autoAlpha: 1,
    y: 0,
    scale: 1,
    stagger: { each: 0.075, from: "start" },
    clearProps: "opacity,visibility,transform",
  });

  const safetyTimer = window.setTimeout(() => {
    ScrollTrigger.refresh();
    const rect = scene.getBoundingClientRect();
    const visibleOnLoad = rect.top < window.innerHeight * 0.86 && rect.bottom > 0;
    if (visibleOnLoad && timeline.progress() < 0.01) {
      timeline.play(0);
    }
  }, 80);

  return () => {
    window.clearTimeout(safetyTimer);
    timeline.scrollTrigger?.kill();
    timeline.kill();
    gsap.killTweensOf(items);
  };
}

function addParallaxScroll(element: HTMLElement) {
  const distance = motionNumber(element, "motionParallax", 18);
  const scrub = motionNumber(element, "motionScrub", 0.85);
  const tween = gsap.fromTo(
    element,
    { y: distance },
    {
      y: -distance,
      ease: "none",
      scrollTrigger: {
        trigger: element,
        start: "clamp(top bottom)",
        end: "clamp(bottom top)",
        scrub,
      },
    },
  );

  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
    gsap.killTweensOf(element);
  };
}

function addVizTimeline(group: HTMLElement) {
  const bars = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.vizBar, group);
  const paths = gsap.utils.toArray<SVGGeometryElement>(premiumMotion.selector.vizPath, group);
  const points = gsap.utils.toArray<SVGElement>(premiumMotion.selector.vizPoint, group);
  if (!bars.length && !paths.length && !points.length) return () => {};

  bars.forEach((bar) => {
    gsap.set(bar, {
      transformOrigin: bar.dataset.motionOrigin ?? "left center",
      scaleX: 0,
    });
  });
  paths.forEach((path) => {
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  });
  gsap.set(points, { autoAlpha: 0, scale: 0.74, transformOrigin: "center center" });

  const timeline = gsap.timeline({
    defaults: {
      duration: premiumMotion.duration.viz,
      ease: premiumMotion.ease.chart,
    },
    scrollTrigger: {
      trigger: group,
      start: "clamp(top 82%)",
      once: true,
    },
  });

  if (bars.length) {
    timeline.to(bars, { scaleX: 1, stagger: 0.045, overwrite: "auto" }, 0);
  }
  if (paths.length) {
    timeline.to(paths, { strokeDashoffset: 0, stagger: 0.08, overwrite: "auto" }, 0.06);
  }
  if (points.length) {
    timeline.to(
      points,
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.42,
        ease: premiumMotion.ease.reward,
        stagger: 0.045,
        overwrite: "auto",
      },
      0.34,
    );
  }

  return () => {
    timeline.scrollTrigger?.kill();
    timeline.kill();
    gsap.killTweensOf([...bars, ...paths, ...points]);
  };
}

/**
 * v2 primitive: split-text entrance (data-motion-split="lines" | "chars").
 * Chinese copy has no word boundaries, so "lines" (default, masked line rise)
 * and "chars" (short display headings) are the supported modes. SplitText 3.13+
 * ships aria:"auto" (label on the container, pieces hidden), so screen readers
 * keep reading the original sentence.
 */
function animateSplitTarget(target: HTMLElement) {
  const mode = target.dataset.motionSplit === "chars" ? "chars" : "lines";
  const split = SplitText.create(target, {
    type: mode,
    ...(mode === "lines" ? { mask: "lines" as const } : {}),
  });
  const pieces = mode === "chars" ? split.chars : split.lines;
  if (!pieces.length) {
    split.revert();
    return () => {};
  }

  gsap.set(target, { visibility: "visible" });
  const tween = gsap.from(pieces, {
    yPercent: mode === "lines" ? 112 : 60,
    autoAlpha: mode === "lines" ? 1 : 0,
    duration: premiumMotion.duration.split,
    ease: premiumMotion.ease.standard,
    delay: motionDelay(target),
    stagger: mode === "lines" ? 0.09 : 0.02,
    onComplete: () => split.revert(),
  });

  return () => {
    tween.kill();
    split.revert();
  };
}

/**
 * v2 primitive: magnetic CTA (data-motion-magnetic, optional data-motion-strength).
 * The element is gently pulled toward the pointer while hovered and springs back
 * on leave — the landing.love-tier affordance for primary buttons/logos.
 */
function addMagneticInteraction(element: HTMLElement) {
  const strength = motionNumber(element, "motionStrength", 12);
  const xTo = gsap.quickTo(element, "x", {
    duration: 0.32,
    ease: premiumMotion.ease.standard,
  });
  const yTo = gsap.quickTo(element, "y", {
    duration: 0.32,
    ease: premiumMotion.ease.standard,
  });

  const move = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
    const py = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
    xTo(px * strength * 2);
    yTo(py * strength * 2);
  };
  const leave = () => {
    gsap.to(element, {
      x: 0,
      y: 0,
      duration: premiumMotion.duration.magneticReturn,
      ease: premiumMotion.ease.standard,
      overwrite: "auto",
    });
  };

  element.addEventListener("pointermove", move);
  element.addEventListener("pointerleave", leave);
  element.addEventListener("pointercancel", leave);

  return () => {
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerleave", leave);
    element.removeEventListener("pointercancel", leave);
    gsap.killTweensOf(element);
  };
}

/**
 * v2 primitive: pinned scroll story (data-motion-story wrapping N
 * data-motion-story-step children). Desktop (≥1024px): the container pins and
 * scrubbing crossfades step i → i+1, giving the hero a three-act narrative.
 * The steps are stacked into the same grid cell for the pin's duration.
 * Mobile / reduced motion: no pin — steps flow and stay fully visible.
 */
function addStoryPin(container: HTMLElement) {
  const steps = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.storyStep, container);
  if (steps.length < 2) {
    return () => {};
  }

  // 审查 #2：断点判定交给 gsap.matchMedia——桌面宽度进入断点自动建 pin，
  // 离开断点（平板旋转/窗口缩放）自动执行 context 清理恢复自然平铺，
  // 双向都可恢复；一次性 matchMedia 快照会把错误模式残留到路由切换。
  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px)", () => {
    const previousDisplay = container.style.display;
    try {
      container.style.display = "grid";
      steps.forEach((step) => {
        step.style.gridArea = "1 / 1";
      });
      // 交付审查：隐藏态用 opacity 而非 autoAlpha——autoAlpha 会写
      // visibility:hidden，把第 2/3 幕整体移出无障碍树，读屏的标题导航/
      // 虚拟光标永远读不到「练 / 看见成长」。opacity:0 保留在 a11y 树；
      // pointerEvents:none 防止叠放的隐藏幕挡住当前幕的指针交互。
      gsap.set(steps.slice(1), { opacity: 0, y: 44, pointerEvents: "none" });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: `+=${steps.length * 85}%`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
        },
      });

      steps.forEach((step, index) => {
        if (index === 0) return;
        const at = index - 0.5;
        timeline
          .to(steps[index - 1], { opacity: 0, y: -36, pointerEvents: "none", duration: 0.5 }, at)
          .to(step, { opacity: 1, y: 0, pointerEvents: "auto", duration: 0.5 }, at + 0.18);
      });

      return () => {
        timeline.scrollTrigger?.kill();
        timeline.kill();
        gsap.killTweensOf(steps);
        gsap.set(steps, { clearProps: "opacity,visibility,transform,pointerEvents" });
        steps.forEach((step) => {
          step.style.gridArea = "";
        });
        container.style.display = previousDisplay;
      };
    } catch {
      // 审查 #11 兜底：pin 构建异常时绝不让 2/3 幕停留在隐藏态——
      // 内容可见性优先于动效（与 revealSafety 同一原则）。
      gsap.set(steps, { autoAlpha: 1, clearProps: "transform,pointerEvents" });
      steps.forEach((step) => {
        step.style.gridArea = "";
      });
      container.style.display = previousDisplay;
      return undefined;
    }
  });

  return () => mm.revert();
}

function observeOnce(targets: HTMLElement[], callback: (target: HTMLElement) => void) {
  if (!targets.length) return () => {};

  // No IntersectionObserver (very old / limited client): run immediately so reveal
  // targets can never get stuck at visibility:hidden.
  if (typeof IntersectionObserver === "undefined") {
    targets.forEach((target) => callback(target));
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = entry.target as HTMLElement;
        observer.unobserve(target);
        callback(target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.16 },
  );

  targets.forEach((target) => observer.observe(target));
  return () => observer.disconnect();
}

function motionElementsFromNode<T extends Element>(node: Node, selector: string) {
  if (!(node instanceof HTMLElement || node instanceof SVGElement)) return [];

  const matches: T[] = [];
  if (node.matches(selector)) matches.push(node as unknown as T);
  matches.push(...Array.from(node.querySelectorAll<T>(selector)));
  return matches;
}

export function PremiumMotionProvider({ deferred = false }: { deferred?: boolean } = {}) {
  const pathname = usePathname();

  useGSAP(
    () => {
      if (typeof window === "undefined") return;

      const reduceMotion = prefersReducedMotion();
      const cleanups: Array<() => void> = [];
      const liftAttached = new WeakSet<HTMLElement>();
      const depthAttached = new WeakSet<HTMLElement>();
      const revealAttached = new WeakSet<HTMLElement>();
      const vizAttached = new WeakSet<HTMLElement>();
      const drawAttached = new WeakSet<SVGGeometryElement>();
      const barAttached = new WeakSet<HTMLElement>();
      const entranceAttached = new WeakSet<HTMLElement>();
      const splitAttached = new WeakSet<HTMLElement>();
      const magneticAttached = new WeakSet<HTMLElement>();
      const storyAttached = new WeakSet<HTMLElement>();
      const revealTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.reveal);
      const cardTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.card);
      const buttonTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.button);
      const floatTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.float);
      const shineTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.shine);
      const numberTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.number);
      const drawTargets = gsap.utils.toArray<SVGGeometryElement>(premiumMotion.selector.draw);
      const barTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.bar);
      const rewardTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.reward);
      const depthTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.depth);
      const overlayTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.overlay);
      const modalTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.modal);
      const drawerTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.drawer);
      const sceneTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.scene);
      const sceneItemTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.sceneItem);
      const parallaxTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.parallax);
      const vizTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.viz);
      const vizBarTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.vizBar);
      const vizPathTargets = gsap.utils.toArray<SVGGeometryElement>(premiumMotion.selector.vizPath);
      const vizPointTargets = gsap.utils.toArray<SVGElement>(premiumMotion.selector.vizPoint);
      const splitTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.split);
      const magneticTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.magnetic);
      const storyTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.story);
      const storyStepTargets = gsap.utils.toArray<HTMLElement>(premiumMotion.selector.storyStep);

      if (reduceMotion) {
        gsap.set(
          [
            ...revealTargets,
            ...cardTargets,
            ...buttonTargets,
            ...floatTargets,
            ...shineTargets,
            ...barTargets,
            ...rewardTargets,
            ...depthTargets,
            ...overlayTargets,
            ...modalTargets,
            ...drawerTargets,
            ...sceneTargets,
            ...sceneItemTargets,
            ...parallaxTargets,
            ...vizTargets,
            ...vizBarTargets,
            ...vizPathTargets,
            ...vizPointTargets,
            // v2: split text never splits, story steps all stay visible (no pin),
            // magnetic CTAs stay put — reduced motion reads as a static page.
            ...splitTargets,
            ...storyTargets,
            ...storyStepTargets,
          ],
          { autoAlpha: 1, clearProps: "transform,opacity,visibility" },
        );
        numberTargets.forEach((target) => animateNumber(target, true));
        drawTargets.forEach((target) => animateDraw(target, true));
        vizPathTargets.forEach((target) => animateDraw(target, true));
        vizBarTargets.forEach((target) => gsap.set(target, { scaleX: 1 }));
        return;
      }

      const attachRevealTarget = (target: HTMLElement) => {
        if (revealAttached.has(target)) return;
        revealAttached.add(target);
        gsap.set(target, { autoAlpha: 0, y: 24 });
        cleanups.push(
          observeOnce([target], (entry) => {
            gsap.to(entry, {
              autoAlpha: 1,
              y: 0,
              duration: premiumMotion.duration.reveal,
              delay: motionDelay(entry),
              ease: premiumMotion.ease.standard,
              overwrite: "auto",
            });
          }),
        );
      };

      const attachLiftTarget = (target: HTMLElement, lift: number) => {
        if (liftAttached.has(target)) return;
        liftAttached.add(target);
        cleanups.push(addLiftInteraction(target, lift));
      };

      const attachDepthTarget = (target: HTMLElement) => {
        if (depthAttached.has(target)) return;
        depthAttached.add(target);
        cleanups.push(addDepthInteraction(target));
      };

      const attachDrawTarget = (target: SVGGeometryElement) => {
        if (drawAttached.has(target)) return;
        drawAttached.add(target);
        cleanups.push(
          observeOnce([target as unknown as HTMLElement], (entry) =>
            animateDraw(entry as unknown as SVGGeometryElement, false),
          ),
        );
      };

      const attachBarTarget = (target: HTMLElement) => {
        if (barAttached.has(target)) return;
        barAttached.add(target);
        cleanups.push(observeOnce([target], (entry) => animateBar(entry, false)));
      };

      const attachVizTarget = (target: HTMLElement) => {
        if (vizAttached.has(target)) return;
        vizAttached.add(target);
        cleanups.push(addVizTimeline(target));
      };

      const attachSplitTarget = (target: HTMLElement) => {
        if (splitAttached.has(target)) return;
        splitAttached.add(target);
        // BUNDLE-1 镜像（审查 #1）：公开站的 provider 是 deferred 异步 chunk——
        // 首屏已可见、用户正在阅读的 split 目标（如 hero LCP 标题）绝不重播入场，
        // 否则 chunk 到达瞬间标题会消失再重来。只对折下内容做 split 入场。
        if (deferred && target.getBoundingClientRect().top < window.innerHeight) return;
        // 审查 #3：内层清理经稳定包装同步注册，才能被 GSAP-1 的逐元素释放
        // （dynamicCleanups slice 捕获）正确回收——IO 异步回调里产生的清理
        // 否则只会落进路由级数组，动态卸载的元素带着进行中的 tween 泄漏到路由切换。
        let innerCleanup: (() => void) | null = null;
        cleanups.push(() => {
          innerCleanup?.();
          innerCleanup = null;
        });
        cleanups.push(
          observeOnce([target], (entry) => {
            innerCleanup = animateSplitTarget(entry);
          }),
        );
      };

      const attachMagneticTarget = (target: HTMLElement) => {
        if (magneticAttached.has(target)) return;
        magneticAttached.add(target);
        cleanups.push(addMagneticInteraction(target));
      };

      const attachStoryTarget = (target: HTMLElement) => {
        if (storyAttached.has(target)) return;
        storyAttached.add(target);
        // 交付审查：deferred chunk 迟到时若用户已滚入/滚过三幕区，建 pin 会在
        // 脚下插入 ~2.5 视口高的 pin-spacer，正在阅读的内容整体位移——与
        // split/reveal 的首屏豁免同一原则：迟到就保持自然平铺，不再建 pin。
        if (deferred && target.getBoundingClientRect().top < 0) return;
        cleanups.push(addStoryPin(target));
      };

      const animateOverlayTarget = (target: HTMLElement) => {
        if (entranceAttached.has(target)) return;
        entranceAttached.add(target);
        const tween = gsap.fromTo(
          target,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 0.22,
            ease: premiumMotion.ease.standard,
            overwrite: "auto",
          },
        );
        cleanups.push(() => tween.kill());
      };

      const animateModalTarget = (target: HTMLElement) => {
        if (entranceAttached.has(target)) return;
        entranceAttached.add(target);
        const tween = gsap.fromTo(
          target,
          { autoAlpha: 0, y: 18, scale: 0.97 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.32,
            ease: premiumMotion.ease.standard,
            overwrite: "auto",
          },
        );
        cleanups.push(() => tween.kill());
      };

      const animateDrawerTarget = (target: HTMLElement) => {
        if (entranceAttached.has(target)) return;
        entranceAttached.add(target);
        const side = target.dataset.motionSide ?? "right";
        const fromX = side === "left" ? -32 : side === "none" ? 0 : 32;
        const fromY = side === "bottom" ? 28 : 0;
        const tween = gsap.fromTo(
          target,
          { autoAlpha: 0, x: fromX, y: fromY, scale: side === "bottom" ? 0.98 : 1 },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.34,
            ease: premiumMotion.ease.standard,
            overwrite: "auto",
          },
        );
        cleanups.push(() => tween.kill());
      };

      const animateRewardTarget = (target: HTMLElement) => {
        if (entranceAttached.has(target)) return;
        entranceAttached.add(target);
        const tween = gsap.fromTo(
          target,
          { scale: 1, boxShadow: "0 0 0 rgba(240,138,56,0)" },
          {
            scale: 1.018,
            boxShadow: "0 18px 48px rgba(240,138,56,0.26)",
            duration: premiumMotion.duration.reward,
            ease: premiumMotion.ease.reward,
            repeat: 1,
            yoyo: true,
            delay: motionDelay(target),
            overwrite: "auto",
          },
        );
        cleanups.push(() => tween.kill());
      };

      if (revealTargets.length) {
        const revealNow = (target: HTMLElement) => {
          gsap.to(target, {
            autoAlpha: 1,
            y: 0,
            duration: premiumMotion.duration.reveal,
            delay: motionDelay(target),
            ease: premiumMotion.ease.standard,
            overwrite: "auto",
          });
        };

        revealTargets.forEach((target) => revealAttached.add(target));
        // BUNDLE-1: when this provider is deferred off the critical path (public
        // site), leave already-visible above-the-fold reveals untouched so the LCP
        // content never flashes when the chunk loads — only hide + scroll-reveal
        // what's below the fold. When eager (in-bundle), the full set fades up.
        const revealHidden = deferred
          ? revealTargets.filter((target) => target.getBoundingClientRect().top >= window.innerHeight)
          : revealTargets;
        if (revealHidden.length) {
          gsap.set(revealHidden, { autoAlpha: 0, y: 24 });
          cleanups.push(observeOnce(revealHidden, revealNow));

          // Safety net (mirrors addSceneTimeline): if the observer never fires for an
          // element already within / above the viewport, force-reveal it so primary
          // content can never get stuck at visibility:hidden.
          const revealSafety = window.setTimeout(() => {
            revealHidden.forEach((target) => {
              if (Number(gsap.getProperty(target, "opacity")) > 0.01) return;
              if (target.getBoundingClientRect().top < window.innerHeight) revealNow(target);
            });
          }, 1400);
          cleanups.push(() => window.clearTimeout(revealSafety));
        }
      }

      if (numberTargets.length) {
        cleanups.push(observeOnce(numberTargets, (target) => animateNumber(target, false)));
      }

      if (drawTargets.length) {
        drawTargets.forEach((target) => drawAttached.add(target));
        cleanups.push(
          observeOnce(drawTargets as unknown as HTMLElement[], (target) =>
            animateDraw(target as unknown as SVGGeometryElement, false),
          ),
        );
      }

      if (barTargets.length) {
        barTargets.forEach((target) => barAttached.add(target));
        cleanups.push(observeOnce(barTargets, (target) => animateBar(target, false)));
      }

      cardTargets.forEach((target) => attachLiftTarget(target, premiumMotion.lift.card));
      buttonTargets.forEach((target) => attachLiftTarget(target, premiumMotion.lift.button));
      depthTargets.forEach((target) => attachDepthTarget(target));
      sceneTargets.forEach((target) => cleanups.push(addSceneTimeline(target)));
      parallaxTargets.forEach((target) => cleanups.push(addParallaxScroll(target)));
      vizTargets.forEach((target) => attachVizTarget(target));
      splitTargets.forEach((target) => attachSplitTarget(target));
      magneticTargets.forEach((target) => attachMagneticTarget(target));
      storyTargets.forEach((target) => attachStoryTarget(target));

      // GSAP-2: one combined querySelectorAll per node (was 11 separate scans),
      // dispatched by which selector each element matches; mutations are coalesced
      // into a single rAF instead of processed synchronously per DOM insertion.
      const motionHandlers: Array<[string, (el: HTMLElement) => void]> = [
        [premiumMotion.selector.reveal, attachRevealTarget],
        [premiumMotion.selector.card, (el) => attachLiftTarget(el, premiumMotion.lift.card)],
        [premiumMotion.selector.button, (el) => attachLiftTarget(el, premiumMotion.lift.button)],
        [premiumMotion.selector.depth, attachDepthTarget],
        [premiumMotion.selector.draw, (el) => attachDrawTarget(el as unknown as SVGGeometryElement)],
        [premiumMotion.selector.bar, attachBarTarget],
        [premiumMotion.selector.viz, attachVizTarget],
        [premiumMotion.selector.overlay, animateOverlayTarget],
        [premiumMotion.selector.modal, animateModalTarget],
        [premiumMotion.selector.drawer, animateDrawerTarget],
        [premiumMotion.selector.reward, animateRewardTarget],
        [premiumMotion.selector.split, attachSplitTarget],
        [premiumMotion.selector.magnetic, attachMagneticTarget],
        [premiumMotion.selector.story, attachStoryTarget],
      ];
      const combinedMotionSelector = motionHandlers.map(([selector]) => selector).join(",");

      // GSAP-1: track each dynamically-attached element's cleanups so they are
      // released (pointer listeners + tweens freed, attach-state reset) when the
      // element leaves the DOM — not only on route change — bounding memory on
      // long-lived pages where rows/drawers/panels mount and unmount in place.
      const dynamicCleanups = new Map<Element, Array<() => void>>();
      const attachElement = (element: HTMLElement) => {
        for (const [selector, handler] of motionHandlers) {
          if (!element.matches(selector)) continue;
          const before = cleanups.length;
          handler(element);
          const added = cleanups.slice(before);
          if (added.length) {
            dynamicCleanups.set(element, [...(dynamicCleanups.get(element) ?? []), ...added]);
          }
        }
      };
      const releaseElement = (element: Element) => {
        if (element.isConnected) return; // moved / still mounted — keep its handlers
        const fns = dynamicCleanups.get(element);
        if (!fns) return;
        fns.forEach((fn) => fn());
        dynamicCleanups.delete(element);
        const el = element as HTMLElement;
        liftAttached.delete(el);
        depthAttached.delete(el);
        revealAttached.delete(el);
        vizAttached.delete(el);
        barAttached.delete(el);
        entranceAttached.delete(el);
        splitAttached.delete(el);
        magneticAttached.delete(el);
        storyAttached.delete(el);
        drawAttached.delete(el as unknown as SVGGeometryElement);
      };

      let pendingAdded: HTMLElement[] = [];
      let pendingRemoved: Element[] = [];
      let flushHandle = 0;
      const flushMutations = () => {
        flushHandle = 0;
        const added = pendingAdded;
        const removed = pendingRemoved;
        pendingAdded = [];
        pendingRemoved = [];
        added.forEach(attachElement); // attach before release so add+remove in one frame nets out
        removed.forEach((node) => {
          releaseElement(node);
          if (node instanceof HTMLElement || node instanceof SVGElement) {
            node.querySelectorAll<HTMLElement>(combinedMotionSelector).forEach(releaseElement);
          }
        });
      };

      const dynamicObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            pendingAdded.push(...motionElementsFromNode<HTMLElement>(node, combinedMotionSelector));
          });
          mutation.removedNodes.forEach((node) => {
            if (node instanceof HTMLElement || node instanceof SVGElement) pendingRemoved.push(node);
          });
        }
        if (!flushHandle) flushHandle = requestAnimationFrame(flushMutations);
      });
      dynamicObserver.observe(document.body, { childList: true, subtree: true });
      cleanups.push(() => {
        if (flushHandle) cancelAnimationFrame(flushHandle);
        dynamicObserver.disconnect();
      });

      overlayTargets.forEach(animateOverlayTarget);
      modalTargets.forEach(animateModalTarget);
      drawerTargets.forEach(animateDrawerTarget);
      rewardTargets.forEach(animateRewardTarget);

      floatTargets.forEach((target, index) => {
        gsap.set(target, { willChange: "transform" });
        gsap.to(target, {
          y: index % 2 === 0 ? -8 : 8,
          scale: 1.012,
          duration: 3.4 + index * 0.22,
          ease: premiumMotion.ease.ambient,
          repeat: -1,
          yoyo: true,
          overwrite: "auto",
        });
      });

      shineTargets.forEach((target) => {
        gsap.set(target, { willChange: "transform, opacity" });
        gsap.fromTo(
          target,
          { xPercent: -120, autoAlpha: 0.25 },
          {
            xPercent: 120,
            autoAlpha: 0.72,
            duration: 3.8,
            ease: "power1.inOut",
            repeat: -1,
            repeatDelay: 2.4,
            overwrite: "auto",
          },
        );
      });

      return () => {
        cleanups.forEach((cleanup) => cleanup());
        gsap.killTweensOf([
          ...revealTargets,
          ...cardTargets,
          ...buttonTargets,
          ...floatTargets,
          ...shineTargets,
          ...numberTargets,
          ...drawTargets,
          ...barTargets,
          ...rewardTargets,
          ...depthTargets,
          ...overlayTargets,
          ...modalTargets,
          ...drawerTargets,
          ...sceneTargets,
          ...sceneItemTargets,
          ...parallaxTargets,
          ...vizTargets,
          ...vizBarTargets,
          ...vizPathTargets,
          ...vizPointTargets,
          ...splitTargets,
          ...magneticTargets,
          ...storyTargets,
          ...storyStepTargets,
        ]);
      };
    },
    { dependencies: [pathname, deferred], revertOnUpdate: true },
  );

  return null;
}
