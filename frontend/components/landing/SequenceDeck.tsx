import Link from "next/link";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";

const CARDS = [
  {
    gene: "LIG1",
    role: "DNA ligase I",
    species: "Homo sapiens ↔ Balaenoptera musculus",
    note: "BER pathway junction enzyme · toroidal clamp architecture, writhe-mapped in the 3D workspace",
    seq: "MQRSIMSFFHPKKEGKAKKPEKEASNSSRETEPPPKAALKEWGQVISDLSPKVQPVVPPTK…",
  },
  {
    gene: "PNKP",
    role: "Polynucleotide kinase 3′-phosphatase",
    species: "Homo sapiens ↔ Balaenoptera musculus",
    note: "End-processing enzyme of the base-excision-repair pathway",
    seq: "MGEVEAPGRLWLESPPGAPEGPRDLRAWDGDLGPAQGGARSSSPPGAEVASGQSASR…",
  },
  {
    gene: "RuBisCO",
    role: "Ribulose-1,5-bisphosphate carboxylase",
    species: "Spinacia oleracea (8RUC)",
    note: "Catalytic Mg²⁺ site + carbamylated lysine rendered as binding-geometry markers",
    seq: "MSPQTETKASVGFKAGVKDYKLTYYTPEYETKDTDILAAFRVTPQPGVPPEEAGAAV…",
  },
];

/**
 * Sequence teaser deck: the cards stagger in at 0.1s and the mono sequence
 * snippets hint at the data without pretending to be an alignment.
 */
export function SequenceDeck() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <FloatIn className="mb-14 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-frost">
          Human ↔ blue whale, side by side
        </h2>
        <p className="mt-3 text-mist">
          Challenge proteins of the BER pathway, ready to load in the comparative workspace.
        </p>
      </FloatIn>
      <FloatIn stagger={0.1} className="grid gap-6 md:grid-cols-3">
        {CARDS.map((c) => (
          <GlassCard key={c.gene} className="flex flex-col p-6" hover>
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-frost">{c.gene}</h3>
              <span className="text-xs text-mist/70">{c.role}</span>
            </div>
            <p className="mt-1 text-xs text-glow-cyan/90">{c.species}</p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-mist">{c.note}</p>
            <p className="mt-4 overflow-hidden rounded-lg border border-white/5 bg-ink-950/60 px-3 py-2 font-mono text-[10px] leading-relaxed tracking-tight text-mist/80">
              {c.seq}
            </p>
          </GlassCard>
        ))}
      </FloatIn>
      <FloatIn className="mt-12 text-center">
        <Link href="/workspace/comparative" className="btn-ghost">
          Open comparative genomics →
        </Link>
      </FloatIn>
    </section>
  );
}
