"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { CatalogEntry, StructureModel } from "@/lib/types";
import { fmt, plddtBand, MARKER, writheColor } from "@/lib/format";
import { GlassCard } from "@/components/antigravity/GlassCard";
import type { ColorMode } from "@/components/three/ProteinViewer";

const ProteinViewer = dynamic(() => import("@/components/three/ProteinViewer"), {
  ssr: false,
  loading: () => <ViewerPlaceholder />,
});

type LoadKind = "pdb" | "alphafold";

const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: "chain", label: "Chain" },
  { id: "plddt", label: "pLDDT / B-factor" },
  { id: "writhe", label: "Backbone writhe" },
];

export default function StructurePage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [model, setModel] = useState<StructureModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<LoadKind>("pdb");
  const [id, setId] = useState("1X9N");
  const [colorMode, setColorMode] = useState<ColorMode>("chain");
  const [showActiveSite, setShowActiveSite] = useState(true);
  const [showMetals, setShowMetals] = useState(true);
  const booted = useRef(false);

  useEffect(() => {
    api<{ entries: CatalogEntry[] }>("/structure/catalog")
      .then((r) => setCatalog(r.entries))
      .catch(() => {});
  }, []);

  const loadPdb = useCallback(async (pdbId: string) => {
    setLoading(true);
    setError(null);
    try {
      setModel(await api<StructureModel>(`/structure/rcsb/${pdbId.trim().toUpperCase()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load structure.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlphafold = useCallback(async (acc: string) => {
    setLoading(true);
    setError(null);
    try {
      setModel(await api<StructureModel>(`/structure/alphafold/${acc.trim().toUpperCase()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load structure.");
    } finally {
      setLoading(false);
    }
  }, []);

  // First visit: float the LIG1 catalytic core in automatically.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    loadPdb("1X9N");
  }, [loadPdb]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "pdb") loadPdb(id);
    else loadAlphafold(id);
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Structure workspace</h1>
        <p className="mt-2 max-w-2xl text-mist">
          Backbone tubes colored by chain, confidence or local writhe; catalytic residues and
          metal ions float as labeled markers.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
        {/* ── Control rail ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          <GlassCard className="p-5" hover={false}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-frost/90 uppercase">Load structure</h2>
            <form onSubmit={submit} className="space-y-3">
              <div className="flex rounded-full border border-white/10 bg-ink-950/50 p-1" role="radiogroup" aria-label="Identifier type">
                {(["pdb", "alphafold"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs transition-colors duration-300 ease-out ${
                      kind === k ? "bg-white/10 font-medium text-frost" : "text-mist hover:text-frost"
                    }`}
                  >
                    {k === "pdb" ? "PDB ID" : "UniProt"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder={kind === "pdb" ? "e.g. 1X9N" : "e.g. P18858"}
                  aria-label="Structure identifier"
                  className="glass-panel min-w-0 flex-1 px-3 py-2 font-mono text-sm text-frost placeholder:text-mist/40 focus:border-glow-cyan/50 focus:outline-none"
                />
                <button type="submit" disabled={loading} className="btn-primary !px-4 !py-2 text-sm">
                  {loading ? "…" : "Load"}
                </button>
              </div>
            </form>
            {catalog.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] tracking-wide text-mist/60 uppercase">Challenge structures</p>
                <div className="flex flex-wrap gap-2">
                  {catalog.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setKind("pdb");
                        setId(c.pdb);
                        loadPdb(c.pdb);
                      }}
                      className="chip transition-colors duration-300 ease-out hover:border-glow-cyan/40 hover:text-frost"
                      title={c.note}
                    >
                      {c.pdb} · {c.id.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5" hover={false}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-frost/90 uppercase">Backbone color</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Backbone color mode">
              {COLOR_MODES.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={colorMode === m.id}
                  onClick={() => setColorMode(m.id)}
                  className={`chip transition-colors duration-300 ease-out ${
                    colorMode === m.id
                      ? "border-glow-cyan/50 bg-glow-cyan/10 text-frost"
                      : "hover:text-frost"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <ColorLegend mode={colorMode} />
          </GlassCard>

          <GlassCard className="p-5" hover={false}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-frost/90 uppercase">Markers</h2>
            <div className="space-y-2">
              {[
                { key: "site", label: "Active-site residues", on: showActiveSite, set: setShowActiveSite, color: MARKER.residue },
                { key: "metal", label: "Metal ions", on: showMetals, set: setShowMetals, color: MARKER.metal },
              ].map((t) => (
                <button
                  key={t.key}
                  role="switch"
                  aria-checked={t.on}
                  onClick={() => t.set(!t.on)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-300 ease-out hover:bg-white/5"
                >
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors duration-300 ease-out ${t.on ? "bg-glow-cyan/40" : "bg-white/10"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ease-out ${t.on ? "translate-x-4" : "translate-x-0.5"}`}
                    />
                  </span>
                  <span className="flex-1 text-frost/90">{t.label}</span>
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                </button>
              ))}
            </div>
          </GlassCard>

          {model && <StatsPanel model={model} />}
        </div>

        {/* ── Viewer ──────────────────────────────────────────────────── */}
        <GlassCard className="relative h-[68vh] min-h-[480px] overflow-hidden" hover={false}>
          {model && !loading && (
            <ProteinViewer
              model={model}
              colorMode={colorMode}
              showActiveSite={showActiveSite}
              showMetals={showMetals}
            />
          )}
          {loading && <Overlay>Suspending coordinates in the void…</Overlay>}
          {error && !loading && <Overlay tone="error">{error}</Overlay>}
          <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-2">
            {model && (
              <>
                <span className="chip !bg-ink-950/70 backdrop-blur-md">
                  {model.pdb_id ?? model.uniprot}
                </span>
                <span className="chip !bg-ink-950/70 backdrop-blur-md">{model.source}</span>
              </>
            )}
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2">
            <span className="chip !bg-ink-950/70 backdrop-blur-md">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: MARKER.residue }} />
              catalytic residue
            </span>
            <span className="chip !bg-ink-950/70 backdrop-blur-md">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: MARKER.metal }} />
              metal ion
            </span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ColorLegend({ mode }: { mode: ColorMode }) {
  if (mode === "chain") {
    return <p className="mt-3 text-xs leading-relaxed text-mist/70">Distinct hue per chain (validated categorical palette).</p>;
  }
  if (mode === "plddt") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {[95, 80, 60, 40].map((v) => {
          const band = plddtBand(v);
          return (
            <span key={band.label} className="chip">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: band.color }} />
              {band.label} · {band.range}
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-mist/80">
      <span className="chip !border-violet-300/30">− twist</span>
      <span
        aria-hidden
        className="h-2 w-40 rounded-full"
        style={{ background: `linear-gradient(90deg, ${writheColor(-1, 1)}, ${writheColor(0, 1)}, ${writheColor(1, 1)})` }}
      />
      <span className="chip !border-sky-300/30">+ twist</span>
      <span className="text-mist/60">(per-residue local writhe, signed)</span>
    </div>
  );
}

function StatsPanel({ model }: { model: StructureModel }) {
  const mean = model.mean_plddt;
  const band = mean !== undefined ? plddtBand(mean) : null;
  return (
    <GlassCard className="p-5" hover={false}>
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-frost/90 uppercase">Model stats</h2>
      <dl className="space-y-2 text-sm">
        <Stat k="Title" v={model.title} />
        <Stat k="Chains" v={model.chains.join(", ")} />
        <Stat k="Residues (trace)" v={`${model.residue_count}${model.full_residue_count ? ` / ${model.full_residue_count} full` : ""}`} />
        <Stat
          k="Total writhe"
          v={model.writhe === null || model.writhe === undefined ? "—" : fmt(model.writhe, 3)}
          accent={model.writhe && model.writhe !== 0 ? (model.writhe > 0 ? "#3987e5" : "#9085e9") : undefined}
        />
        <Stat
          k="Mean pLDDT"
          v={mean === undefined ? "—" : `${fmt(mean, 1)}`}
          chip={band ? { color: band.color, label: band.label } : undefined}
        />
        <Stat k="Active-site residues" v={fmt(model.active_sites?.reduce((n, s) => n + s.residues.length, 0) ?? 0, 0)} />
        <Stat k="Metal ions" v={fmt(model.metals?.length ?? 0, 0)} />
      </dl>
    </GlassCard>
  );
}

function Stat({ k, v, accent, chip }: { k: string; v: string; accent?: string; chip?: { color: string; label: string } }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-mist/70">{k}</dt>
      <dd className="stat-num min-w-0 truncate text-right font-medium" style={accent ? { color: accent } : undefined} title={v}>
        {v}
      </dd>
      {chip && (
        <span className="chip shrink-0">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: chip.color }} />
          {chip.label}
        </span>
      )}
    </div>
  );
}

function Overlay({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <p className={`glass-card max-w-md px-6 py-4 text-center text-sm ${tone === "error" ? "!border-[#d03b3b]/40 text-[#e66767]" : "text-mist"}`}>
        {children}
      </p>
    </div>
  );
}

function ViewerPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-mist/60">Warming up the renderer…</p>
    </div>
  );
}
