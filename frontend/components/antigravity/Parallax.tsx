"use client";

import { useRef, type ReactNode } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect, usePrefersReducedMotion } from "@/lib/motion";

type ParallaxProps = {
  children: ReactNode;
  className?: string;
  /** <1 = moves slower than scroll (background); >1 = faster (foreground). */
  speed?: number;
  /** Total travel in px across the trigger's scroll range. */
  travel?: number;
};

/**
 * Scroll-linked parallax via ScrollTrigger scrub. Layers move at different
 * speeds to create Z-depth: background elements use speed < 1 so they lag
 * behind the foreground. Transform-only; disabled under reduced motion.
 */
export function Parallax({ children, className, speed = 0.5, travel = 140 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (!ref.current || reduced) return;
    const el = ref.current;
    const trigger = el.parentElement ?? el;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { y: -travel * speed },
        {
          y: travel * speed,
          ease: "none",
          scrollTrigger: {
            trigger,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        },
      );
    }, ref);
    return () => ctx.revert();
  }, [reduced, speed, travel]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
