"use client";

import { STATUS } from "@/lib/format";
import type { VariantImpact } from "@/lib/types";

/**
 * Research-grade consensus meter (weighted, transparent, NOT a clinical
 * verdict). Only sources that answered contribute; the meter scales by the
 * maximum reachable weight so a missing source cannot bias the result.
 *
 * Weights: AlphaMissense pathogenic=2 / ambiguous=1 / benign=0 ·
 *          SIFT deleterious=1.5 / tolerated=0 ·
 *          pLDDT at position <50 → 1.2, 50–70 → 0.6, else 0.
 */
export function ConsensusMeter({ impact }: { impact: VariantImpact }) {
  const parts = collect(impact);
  const maxWeight = parts.reduce((n, p) => n + p.max, 0);
  const weight = parts.reduce((n, p) => n + p.got, 0);
  const score = maxWeight > 0 ? weight / maxWeight : 0;

  const level =
    score > 0.66
      ? { label: "High predicted impact", color: STATUS.critical }
      : score > 0.34
        ? { label: "Moderate predicted impact", color: STATUS.warning }
        : { label: "Low predicted impact", color: STATUS.good };

  return (
    <div className="glass-card flex h-full flex-col p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-[0.18em] text-mist/50 uppercase">Consensus</span>
        <span className="chip">{parts.length}/3 sources answered</span>
      </div>
      <h3 className="text-base font-semibold text-frost">{level.label}</h3>
      <div className="mt-4 flex h-3 gap-1" aria-hidden>
        {[0, 1, 2].map((seg) => {
          const segMin = seg / 3;
          const segMax = (seg + 1) / 3;
          const fill = Math.max(0, Math.min(score, segMax) - segMin) / (1 / 3);
          return (
            <span key={seg} className="flex-1 overflow-hidden rounded-full bg-white/5">
              <span
                className="block h-full rounded-full transition-transform duration-500 ease-out"
                style={{ background: level.color, transform: `scaleX(${fill})`, transformOrigin: "left" }}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-mist/60">
        <span>low</span>
        <span>moderate</span>
        <span>high</span>
      </div>
      <ul className="mt-4 space-y-1.5 text-xs text-mist/80">
        {parts.map((p) => (
          <li key={p.key} className="flex justify-between gap-3">
            <span>{p.label}</span>
            <span className="stat-num font-medium text-frost/90">
              {p.got.toFixed(1)} / {p.max.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-mist/50">
        Research preview — a transparent aggregation of public annotations, not a clinical
        interpretation.
      </p>
    </div>
  );
}

function collect(impact: VariantImpact) {
  const parts: { key: string; label: string; max: number; got: number }[] = [];
  if (impact.alphamissense.status === "ok" && typeof impact.alphamissense.class === "string") {
    const am = { key: "am", label: "AlphaMissense", max: 2, got: 0 };
    if (impact.alphamissense.class === "pathogenic") am.got = 2;
    else if (impact.alphamissense.class === "ambiguous") am.got = 1;
    parts.push(am);
  }
  if (impact.sift.status === "ok" && impact.sift.sift) {
    const sift = { key: "sift", label: "SIFT", max: 1.5, got: 0 };
    if (impact.sift.sift.prediction === "deleterious") sift.got = 1.5;
    else if (impact.sift.sift.prediction === "tolerated_low_confidence") sift.got = 0.75;
    parts.push(sift);
  }
  if (impact.plddt.status === "ok" && typeof impact.plddt.plddt === "number") {
    const p = { key: "plddt", label: "pLDDT at position", max: 1.2, got: 0 };
    if (impact.plddt.plddt < 50) p.got = 1.2;
    else if (impact.plddt.plddt < 70) p.got = 0.6;
    parts.push(p);
  }
  return parts;
}
