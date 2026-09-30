"use client";

import { domainColor, domainIsOther } from "@/lib/format";
import type { InterProDomain } from "@/lib/types";

interface DomainTrackProps {
  domains: InterProDomain[];
  /** Protein length in residues (track scale). */
  length: number;
}

/**
 * InterPro domain architecture track. One row per annotated region (Gantt
 * style — overlapping entries get their own rows rather than a lying stacked
 * bar). Colors are the validator-passed categorical slots in fixed order;
 * rare entry types additionally carry a texture. Every row is directly
 * labeled with name + range, so identity is never color-alone.
 */
export function DomainTrack({ domains, length }: DomainTrackProps) {
  if (domains.length === 0) {
    return (
      <p className="rounded-lg border border-white/5 bg-ink-950/40 px-4 py-6 text-center text-sm text-mist/70">
        No InterPro entries annotated for this protein.
      </p>
    );
  }
  const sorted = [...domains].sort((a, b) => a.start - b.start || a.end - b.end);
  const types = Array.from(new Set(sorted.map((d) => d.type)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" aria-hidden>
        {types.map((t) => (
          <span key={t} className="chip">
            <span className="h-2 w-2 rounded-sm" style={{ background: domainColor(t) }} />
            {t.replace(/_/g, " ")}
          </span>
        ))}
      </div>
      <ol className="space-y-1.5">
        {sorted.map((d) => {
          const left = (d.start / length) * 100;
          const width = Math.max(2, ((d.end - d.start + 1) / length) * 100);
          const other = domainIsOther(d.type);
          return (
            <li
              key={`${d.accession}:${d.start}:${d.end}`}
              className="group flex items-center gap-3 rounded-md px-2 py-1 transition-colors duration-300 ease-out hover:bg-white/5"
              title={`${d.accession} · ${d.name} · ${d.start}–${d.end}`}
            >
              <span className="stat-num w-10 shrink-0 text-right text-[10px] text-mist/50">{d.start}</span>
              <span className="relative h-3.5 flex-1 rounded-sm bg-white/5">
                <span
                  className={`absolute top-0 h-full rounded-sm transition-transform duration-300 ease-out group-hover:scale-y-110 ${other ? "domain-other-fill" : ""}`}
                  style={{ left: `${left}%`, width: `${width}%`, background: domainColor(d.type) }}
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-frost/90">{d.name}</span>
              <span className="stat-num w-24 shrink-0 text-right text-[10px] text-mist/60">
                {d.start}–{d.end}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-mist/50">Track scale: 1–{length} residues · {sorted.length} entries</p>
    </div>
  );
}
