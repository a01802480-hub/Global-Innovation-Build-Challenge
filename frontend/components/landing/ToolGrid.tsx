import Link from "next/link";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { IsometricTilt } from "@/components/antigravity/IsometricTilt";

const TOOLS = [
  {
    href: "/workspace/structure",
    icon: "🧬",
    title: "3D Structure Workspace",
    body: "Interactive backbone rendering with writhe mapping (LIG1) and catalytic-site geometry (RuBisCO Mg²⁺ site), powered by React Three Fiber.",
    tags: ["RCSB", "AlphaFold", "Writhe", "pLDDT"],
  },
  {
    href: "/workspace/comparative",
    icon: "🐋",
    title: "Comparative Genomics",
    body: "Human vs. blue-whale orthologs for BER pathway proteins — Ensembl homology, InterPro domain tracks, pairwise alignment.",
    tags: ["LIG1", "PNKP", "Ensembl", "InterPro"],
  },
  {
    href: "/workspace/variants",
    icon: "⚡",
    title: "Variant Impact",
    body: "One substitution, three verdicts: AlphaFold structural confidence, AlphaMissense pathogenicity and SIFT tolerance — with graceful degradation.",
    tags: ["AlphaMissense", "SIFT", "pLDDT"],
  },
];

/**
 * Tool selection grid: cards float into view staggered by 0.1s, then snap into
 * an isometric perspective on hover (IsometricTilt, transform-only).
 */
export function ToolGrid() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <FloatIn className="mb-14 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-frost">Choose your lens</h2>
        <p className="mt-3 text-mist">Three pipelines, rendered in the same weightless workspace.</p>
      </FloatIn>
      <FloatIn stagger={0.1} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <IsometricTilt key={tool.href} className="h-full">
            <Link href={tool.href} className="block h-full">
              <GlassCard className="flex h-full flex-col p-7">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-3xl" aria-hidden>
                    {tool.icon}
                  </span>
                  <span aria-hidden className="text-lg text-mist/60">
                    →
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-frost">{tool.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mist">{tool.body}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {tool.tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </Link>
          </IsometricTilt>
        ))}
      </FloatIn>
    </section>
  );
}
