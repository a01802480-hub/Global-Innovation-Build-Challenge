"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect, usePrefersReducedMotion } from "@/lib/motion";

const HeroScene = dynamic(() => import("@/components/three/HeroScene"), { ssr: false });

/**
 * Landing hero. The 3D ribbon sits at the deepest layer, the headline floats
 * above it, and a GSAP intro timeline eases everything in (0.8s+ ease-out,
 * never a snap). Reduced motion renders the final state instantly.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (!root.current || reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-hero-fade]",
        { y: 44, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.12,
          delay: 0.15,
        },
      );
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  // GSAP hides these before animating them in; under reduced motion no tween
  // runs, so the hiding class must not be applied at all.
  const fade = (className: string) => `${className}${reduced ? "" : " opacity-0"}`;

  return (
    <section ref={root} className="relative flex min-h-screen flex-col overflow-hidden">
      <HeroScene />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,transparent_0%,rgba(4,6,13,0.55)_100%)]" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        <p data-hero-fade className={fade("chip mb-8")}>
          <span className="h-1.5 w-1.5 rounded-full bg-glow-cyan" />
          GLOBAL INNOVATION BUILD · UNIFIED BIOINFORMATICS WORKSPACE
        </p>
        <h1 data-hero-fade className={fade("max-w-3xl text-5xl leading-[1.08] font-semibold tracking-tight text-frost sm:text-6xl")}>
          Protein analysis,
          <br />
          <span className="text-gradient">weightless.</span>
        </h1>
        <p data-hero-fade className={fade("mt-6 max-w-2xl text-lg leading-relaxed text-mist")}>
          Align sequences, inspect LIG1 backbone writhe in 3D, and predict variant impact —
          in one floating workspace. Structures render live; scores aggregate from
          AlphaFold, AlphaMissense and SIFT.
        </p>
        <div data-hero-fade className={fade("mt-10 flex flex-wrap items-center justify-center gap-4")}>
          <Link href="/workspace/structure" className="btn-primary">
            Open the 3D workspace
            <span aria-hidden>→</span>
          </Link>
          <Link href="/workspace/comparative" className="btn-ghost">
            Comparative genomics
          </Link>
        </div>
      </div>
      <div data-hero-fade className={fade("relative mb-8 flex justify-center")}>
        <div className="scroll-cue" aria-hidden />
      </div>
    </section>
  );
}
