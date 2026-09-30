"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fmt, plddtBand } from "@/lib/format";
import type { StructureModel, VariantImpact } from "@/lib/types";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { ConsensusMeter } from "@/components/workspace/ConsensusMeter";
import { PlddtStrip } from "@/components/workspace/PlddtStrip";
import { ScoreCard, ScoreRow, type ScoreTone } from "@/components/workspace/ScoreCard";

interface FormState {
  uniprot: string;
  position: string;
  ref: string;
  alt: string;
}

const INITIAL: FormState = { uniprot: "P18858", position: "641", ref: "R", alt: "L" };

export default function VariantsPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [result, setResult] = useState<VariantImpact | null>(null);
  const [strip, setStrip] = useState<StructureModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  const submit = useCallback(
    async (f: FormState) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setStrip(null);
      try {
        const pos = parseInt(f.position, 10);
        if (!Number.isInteger(pos) || pos < 1) throw new Error("Position must be a positive integer.");
        const impact = await api<VariantImpact>("/variants/impact", {
          method: "POST",
          body: JSON.stringify({
            uniprot_id: f.uniprot.trim().toUpperCase(),
            position: pos,
            ref: f.ref.trim().toUpperCase(),
            alt: f.alt.trim().toUpperCase(),
          }),
        });
        setResult(impact);
        // Full-trace AlphaFold model powers the per-residue pLDDT strip; its
        // failure must not fail the prediction cards, so it loads separately.
        api<StructureModel>(`/structure/alphafold/${impact.uniprot_id}?full=true`)
          .then(setStrip)
          .catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Variant prediction failed.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    submit(INITIAL);
  }, [submit]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Variant impact</h1>
        <p className="mt-2 max-w-2xl text-mist">
          One substitution, three independent verdicts — AlphaFold structural confidence,
          AlphaMissense pathogenicity, SIFT tolerance. Each source degrades on its own.
        </p>
      </header>

      <GlassCard className="mb-8 p-5" hover={false}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(form);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="UniProt accession">
            <input
              value={form.uniprot}
              onChange={(e) => setForm({ ...form, uniprot: e.target.value })}
              className="glass-panel w-36 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
              aria-label="UniProt accession"
            />
          </Field>
          <Field label="Position">
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="glass-panel w-24 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
              aria-label="Residue position"
            />
          </Field>
          <Field label="Ref">
            <input
              value={form.ref}
              onChange={(e) => setForm({ ...form, ref: e.target.value })}
              maxLength={3}
              className="glass-panel w-16 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
              aria-label="Reference amino acid"
            />
          </Field>
          <Field label="Alt">
            <input
              value={form.alt}
              onChange={(e) => setForm({ ...form, alt: e.target.value })}
              maxLength={3}
              className="glass-panel w-16 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
              aria-label="Alternate amino acid"
            />
          </Field>
          <button type="submit" disabled={loading} className="btn-primary !px-5 !py-2 text-sm">
            {loading ? "Predicting…" : "Predict"}
          </button>
        </form>
        <p className="mt-3 text-xs text-mist/60">
          Demo substitution: P18858 (LIG1) p.Arg641Leu — pathogenic in AlphaMissense (0.976).
        </p>
      </GlassCard>

      {error && (
        <GlassCard className="mb-8 !border-[#d03b3b]/40 p-5 text-sm text-[#e66767]" hover={false}>
          {error}
        </GlassCard>
      )}

      {loading && (
        <div className="grid gap-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      )}

      {result && !loading && (
        <FloatIn stagger={0.1} className="grid items-stretch gap-6 lg:grid-cols-4">
          <PlddtCard impact={result} />
          <AlphaMissenseCard impact={result} />
          <SiftCard impact={result} />
          <ConsensusMeter impact={result} />
        </FloatIn>
      )}

      {result && strip && (
        <FloatIn className="mt-8">
          <GlassCard className="p-6" hover={false}>
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-frost/90 uppercase">
              Per-residue confidence — AlphaFold {result.uniprot_id}
            </h2>
            <PlddtStrip model={strip} position={parseInt(result.variant.match(/\d+/)?.[0] ?? "", 10)} />
          </GlassCard>
        </FloatIn>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wide text-mist/60 uppercase">{label}</span>
      {children}
    </label>
  );
}

function PlddtCard({ impact }: { impact: VariantImpact }) {
  const p = impact.plddt;
  if (p.status !== "ok" || typeof p.plddt !== "number") {
    return (
      <ScoreCard source="AlphaFold" title="Structural confidence" tone="neutral" toneLabel="unavailable">
        <ScoreRow k="Detail" v={p.detail ?? "No pLDDT at this position."} />
      </ScoreCard>
    );
  }
  const band = plddtBand(p.plddt);
  const tone: ScoreTone = p.plddt >= 70 ? "good" : p.plddt >= 50 ? "warning" : "critical";
  return (
    <ScoreCard
      source="AlphaFold"
      title="Structural confidence"
      tone={tone}
      toneLabel={`pLDDT ${fmt(p.plddt, 1)}`}
      footnote="pLDDT is the per-residue model confidence from the AlphaFold DB model file (B-factor column)."
    >
      <ScoreRow k="pLDDT at position" v={<span style={{ color: band.color }}>{fmt(p.plddt, 1)}</span>} />
      <ScoreRow k="Band" v={band.label} />
      <ScoreRow k="Mean model pLDDT" v={fmt(p.mean_model_plddt, 1)} />
    </ScoreCard>
  );
}

function AlphaMissenseCard({ impact }: { impact: VariantImpact }) {
  const a = impact.alphamissense;
  if (a.status !== "ok" || !a.class) {
    return (
      <ScoreCard source="AlphaMissense" title="Pathogenicity" tone="neutral" toneLabel="unavailable">
        <ScoreRow k="Detail" v={a.detail ?? "No AlphaMissense row for this position."} />
      </ScoreCard>
    );
  }
  const tone: ScoreTone =
    a.class === "pathogenic" ? "critical" : a.class === "ambiguous" ? "warning" : a.class === "benign" ? "good" : "neutral";
  return (
    <ScoreCard
      source="AlphaMissense"
      title="Pathogenicity"
      tone={tone}
      toneLabel={a.class.replace(/_/g, " ")}
      footnote="AlphaMissense class for the substitution at this position (hegelab hotspot API)."
    >
      <ScoreRow k="Class" v={a.class} />
      <ScoreRow k="Mean pathogenicity" v={fmt(a.mean_pathogenicity, 4)} mono />
    </ScoreCard>
  );
}

function SiftCard({ impact }: { impact: VariantImpact }) {
  const s = impact.sift;
  if (s.status !== "ok" || !s.sift) {
    return (
      <ScoreCard source="SIFT / VEP" title="Tolerance" tone="neutral" toneLabel="unavailable">
        <ScoreRow k="Detail" v={s.detail ?? "No SIFT consequence for this substitution."} />
      </ScoreCard>
    );
  }
  const pred = s.sift.prediction ?? "";
  const tone: ScoreTone = pred.includes("deleterious") ? "critical" : pred === "tolerated" ? "good" : "warning";
  return (
    <ScoreCard
      source="SIFT / VEP"
      title="Tolerance"
      tone={tone}
      toneLabel={pred.replace(/_/g, " ")}
      footnote="SIFT + PolyPhen computed by Ensembl VEP on the canonical transcript."
    >
      <ScoreRow k="SIFT score" v={fmt(s.sift.score, 3)} mono />
      <ScoreRow k="Prediction" v={pred} />
      {s.polyphen && <ScoreRow k="PolyPhen" v={`${s.polyphen.prediction ?? ""} ${fmt(s.polyphen.score, 3)}`} />}
    </ScoreCard>
  );
}
