import Link from "next/link";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { IsometricTilt } from "@/components/antigravity/IsometricTilt";
import { HealthChip } from "@/components/workspace/HealthChip";

const TOOLS = [
  {
    href: "/workspace/structure",
    icon: "🧬",
    title: "Structure workspace",
    body: "Load LIG1 (1X9N) or RuBisCO (8RUC), color the backbone by chain, pLDDT or local writhe, and inspect catalytic-site geometry in 3D.",
  },
  {
    href: "/workspace/comparative",
    icon: "🐋",
    title: "Comparative genomics",
    body: "LIG1 and PNKP: human vs. blue-whale orthologs with InterPro domain tracks and a pairwise Needleman–Wunsch alignment.",
  },
  {
    href: "/workspace/variants",
    icon: "⚡",
    title: "Variant impact",
    body: "Submit a substitution — get AlphaFold pLDDT, AlphaMissense pathogenicity and SIFT tolerance, each degrading gracefully on its own.",
  },
];

export default function WorkspaceHub() {
  return (
    <div>
      <FloatIn className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-frost">Workspace</h1>
          <p className="mt-2 max-w-xl text-mist">
            Every tool is a floating panel over the same deep-space canvas. Pick a lens, or
            start from the challenge structures below.
          </p>
        </div>
        <HealthChip />
      </FloatIn>
      <FloatIn stagger={0.1} className="grid gap-6 md:grid-cols-3">
        {TOOLS.map((t) => (
          <IsometricTilt key={t.href} className="h-full">
            <Link href={t.href} className="block h-full">
              <GlassCard className="flex h-full flex-col p-7">
                <span className="mb-4 text-3xl" aria-hidden>
                  {t.icon}
                </span>
                <h2 className="text-lg font-semibold text-frost">{t.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mist">{t.body}</p>
                <span className="mt-5 text-sm text-glow-cyan/90">Open →</span>
              </GlassCard>
            </Link>
          </IsometricTilt>
        ))}
      </FloatIn>
    </div>
  );
}
