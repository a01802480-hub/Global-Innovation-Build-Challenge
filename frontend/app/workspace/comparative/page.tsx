"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import type { AlignmentResult, GeneDashboard } from "@/lib/types";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { AlignmentViewer } from "@/components/workspace/AlignmentViewer";
import { DomainTrack } from "@/components/workspace/DomainTrack";
import { OrthologCard } from "@/components/workspace/OrthologCard";

const PRESETS = ["LIG1", "PNKP"];

export default function ComparativePage() {
  const [gene, setGene] = useState("LIG1");
  const [data, setData] = useState<GeneDashboard | null>(null);
  const [alignment, setAlignment] = useState<AlignmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  const load = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    setAlignment(null);
    try {
      const dash = await api<GeneDashboard>(`/comparative/gene/${encodeURIComponent(symbol.trim())}`);
      setData(dash);
      if (dash.human.sequence && dash.ortholog.sequence) {
        setAlignment(
          await api<AlignmentResult>("/alignment/pairwise", {
            method: "POST",
            body: JSON.stringify({
              sequence_a: dash.human.sequence,
              sequence_b: dash.ortholog.sequence,
            }),
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparative dashboard failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    load("LIG1");
  }, [load]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Comparative genomics</h1>
        <p className="mt-2 max-w-2xl text-mist">
          Human BER-pathway proteins against their blue-whale orthologs — Ensembl homology,
          InterPro domain architecture, and a pairwise alignment in one dashboard.
        </p>
      </header>

      <GlassCard className="mb-8 p-5" hover={false}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(gene);
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <span className="text-xs tracking-wide text-mist/60 uppercase">Gene</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setGene(p);
                  load(p);
                }}
                className={`chip transition-colors duration-300 ease-out ${
                  data?.gene === p
                    ? "border-glow-cyan/50 bg-glow-cyan/10 text-frost"
                    : "hover:border-glow-cyan/40 hover:text-frost"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            value={gene}
            onChange={(e) => setGene(e.target.value)}
            placeholder="Custom gene symbol"
            aria-label="Gene symbol"
            className="glass-panel min-w-0 flex-1 px-3 py-2 font-mono text-sm text-frost placeholder:text-mist/40 focus:border-glow-cyan/50 focus:outline-none"
          />
          <button type="submit" disabled={loading} className="btn-primary !px-4 !py-2 text-sm">
            {loading ? "Aligning…" : "Compare"}
          </button>
        </form>
      </GlassCard>

      {error && (
        <GlassCard className="mb-8 !border-[#d03b3b]/40 p-5 text-sm text-[#e66767]" hover={false}>
          {error}
        </GlassCard>
      )}

      {loading && (
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {data && !loading && (
        <>
          <FloatIn stagger={0.1} className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <GlassCard className="p-5">
              <p className="text-xs tracking-wide text-mist/60 uppercase">Human protein</p>
              <p className="mt-2 text-base font-semibold text-frost">{data.human.name ?? data.gene}</p>
              <p className="mt-1 text-xs text-mist/70">
                {data.human.accession} · {fmt(data.human.length, 0)} aa
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-xs tracking-wide text-mist/60 uppercase">Whale ortholog</p>
              <p className="mt-2 text-base font-semibold text-frost">
                {data.ortholog.species_label ?? "Unavailable"}
              </p>
              <p className="mt-1 text-xs text-mist/70">
                {data.ortholog.available
                  ? `${fmt(data.ortholog.percent_identity, 1)}% identity · ${data.ortholog.sequence?.length ?? "—"} aa`
                  : "see detail below"}
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-xs tracking-wide text-mist/60 uppercase">Pairwise identity</p>
              <p className="stat-num mt-2 text-2xl font-semibold text-glow-cyan">
                {alignment ? `${fmt(alignment.identity_pct, 1)}%` : "—"}
              </p>
              <p className="mt-1 text-xs text-mist/70">
                {alignment ? `${alignment.matches} matches · ${alignment.mismatches} mismatches` : "no sequences"}
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-xs tracking-wide text-mist/60 uppercase">InterPro entries</p>
              <p className="stat-num mt-2 text-2xl font-semibold text-glow-violet">{fmt(data.domains.length, 0)}</p>
              <p className="mt-1 text-xs text-mist/70">annotated regions</p>
            </GlassCard>
          </FloatIn>

          <FloatIn stagger={0.1} className="mb-8 grid gap-6 lg:grid-cols-2">
            <GlassCard className="p-6" hover={false}>
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-frost/90 uppercase">
                Ortholog — {data.ortholog.species_label ?? "cetaceans"}
              </h2>
              <OrthologCard ortholog={data.ortholog} />
            </GlassCard>
            <GlassCard className="p-6" hover={false}>
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-frost/90 uppercase">
                Domain architecture — {data.human.accession}
              </h2>
              <DomainTrack domains={data.domains} length={data.human.length ?? 1} />
            </GlassCard>
          </FloatIn>

          <FloatIn className="mb-4">
            {alignment ? (
              <>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-frost/90 uppercase">
                  Needleman–Wunsch alignment
                </h2>
                <AlignmentViewer
                  alignedA={alignment.aligned_a}
                  alignedB={alignment.aligned_b}
                  labelA={`${data.gene} (human)`}
                  labelB={data.ortholog.species_label ?? "ortholog"}
                />
              </>
            ) : (
              <GlassCard className="p-6 text-sm text-mist/70" hover={false}>
                No pairwise alignment available — sequences missing on the human or ortholog side.
              </GlassCard>
            )}
          </FloatIn>
        </>
      )}
    </div>
  );
}
