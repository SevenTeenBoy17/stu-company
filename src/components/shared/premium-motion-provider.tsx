"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { usePathname } from "next/navigation";

gsap.registerPlugin(useGSAP);

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function addLiftInteraction(element: HTMLElement, lift: number) {
  const enter = () => {
    gsap.to(element, {
      y: -lift,
      scale: 1.01,
      duration: 0.32,
      ease: "power3.out",
      overwrite: "auto",
    });
  };
  const leave = () => {
    gsap.to(element, {
      y: 0,
      scale: 1,
      duration: 0.42,
      ease: "power3.out",
      overwrite: "auto",
    });
  };
  const down = () => {
    gsap.to(element, {
      scale: 0.985,
      duration: 0.16,
      ease: "power2.out",
      overwrite: "auto",
    });
  };
  const up = () => {
    gsap.to(element, {
      scale: 1.01,
      duration: 0.2,
      ease: "power2.out",
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
  };
}

export function PremiumMotionProvider() {
  const pathname = usePathname();

  useGSAP(
    () => {
      if (typeof window === "undefined" || prefersReducedMotion()) return;

      const cleanups: Array<() => void> = [];
      const revealTargets = gsap.utils.toArray<HTMLElement>("[data-motion-reveal]");
      const cardTargets = gsap.utils.toArray<HTMLElement>("[data-motion-card]");
      const buttonTargets = gsap.utils.toArray<HTMLElement>("[data-motion-button]");
      const floatTargets = gsap.utils.toArray<HTMLElement>("[data-motion-float]");
      const shineTargets = gsap.utils.toArray<HTMLElement>("[data-motion-shine]");

      if (revealTargets.length) {
        gsap.set(revealTargets, { autoAlpha: 0, y: 26 });
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const target = entry.target as HTMLElement;
              observer.unobserve(target);
              gsap.to(target, {
                autoAlpha: 1,
                y: 0,
                duration: 0.78,
                ease: "power3.out",
                overwrite: "auto",
              });
            });
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.16 },
        );
        revealTargets.forEach((target) => observer.observe(target));
        cleanups.push(() => observer.disconnect());
      }

      cardTargets.forEach((target) => cleanups.push(addLiftInteraction(target, 4)));
      buttonTargets.forEach((target) => cleanups.push(addLiftInteraction(target, 2)));

      floatTargets.forEach((target, index) => {
        gsap.to(target, {
          y: index % 2 === 0 ? -8 : 8,
          scale: 1.012,
          duration: 3.4 + index * 0.22,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          overwrite: "auto",
        });
      });

      shineTargets.forEach((target) => {
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
      };
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return null;
}
