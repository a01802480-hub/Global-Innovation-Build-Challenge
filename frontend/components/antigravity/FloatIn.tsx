"use client";

import { useRef, type ReactNode } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect, usePrefersReducedMotion } from "@/lib/motion";

type FloatInProps = {
  children: ReactNode;
  className?: string;
  /** Seconds between sibling entrances (0.1s stagger is the house rule). */
  stagger?: number;
  /** Entrance rise in px. */
  y?: number;
  delay?: number;
};

/**
 * Weightless entrance: children float up from the Y-axis as they scroll into
 * view. Transform-only (GPU-composited); skipped entirely under reduced motion.
 */
export function FloatIn({ children, className, stagger = 0.1, y = 48, delay = 0 }: FloatInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (!ref.current || reduced) return;
    const targets = Array.from(ref.current.children);
    const ctx = gsap.context(() => {
      gsap.set(targets, { y, autoAlpha: 0 });
      gsap.to(targets, {
        y: 0,
        autoAlpha: 1,
        duration: 0.9,
        ease: "power3.out",
        stagger,
        delay,
        scrollTrigger: {
          trigger: ref.current,
          start: "top 88%",
          once: true,
        },
      });
    }, ref);
    return () => ctx.revert();
  }, [reduced, stagger, y, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
