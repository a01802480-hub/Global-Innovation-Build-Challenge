import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { Parallax } from "@/components/antigravity/Parallax";

const STEPS = [
  {
    n: "01",
    title: "Ingest",
    body: "Server-side proxies for UniProtKB, Ensembl and InterPro — identifiers validated before they ever reach a URL.",
  },
  {
    n: "02",
    title: "Analyze",
    body: "Strict FASTA/PDB parsing, Needleman–Wunsch alignment, and a Gauss-integral writhe kernel pinned by linking-number tests.",
  },
  {
    n: "03",
    title: "Visualize",
    body: "Vertex-colored backbone tubes, isometric dashboards and glass panels that float above a deep-space background.",
  },
];

/**
 * Pipeline band: the steps drift in on scroll (stagger 0.1s) while the section
 * background parallaxes slower than the cards, selling the Z-depth.
 */
export function PipelineBand() {
  return (
    <section className="relative overflow-hidden py-24">
      <Parallax speed={0.35} className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute top-1/3 left-1/2 h-[42vmax] w-[42vmax] -translate-x-1/2 rounded-full opacity-50"
          style={{ background: "radial-gradient(closest-side, rgba(34,211,238,0.07), transparent 70%)" }}
        />
      </Parallax>
      <div className="mx-auto w-full max-w-6xl px-6">
        <FloatIn className="mb-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-frost">One stream, three stages</h2>
          <p className="mt-3 text-mist">From raw identifiers to floating structures.</p>
        </FloatIn>
        <FloatIn stagger={0.1} className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <GlassCard key={s.n} className="p-7" hover>
              <span className="stat-num text-gradient text-4xl font-semibold">{s.n}</span>
              <h3 className="mt-4 text-lg font-semibold text-frost">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{s.body}</p>
            </GlassCard>
          ))}
        </FloatIn>
      </div>
    </section>
  );
}
