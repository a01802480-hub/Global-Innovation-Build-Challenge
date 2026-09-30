"use client";

import { useMemo } from "react";
import { plddtBand } from "@/lib/format";
import type { StructureModel } from "@/lib/types";

interface PlddtStripProps {
  model: StructureModel;
  /** 1-based residue position to mark (the queried variant). */
  position?: number;
}

const BAR_W = 3;
const BAR_H = 26;

/**
 * Per-residue pLDDT strip (canonical AlphaFold band colors, always labeled).
 * The queried variant position is marked with a white tick + label so the
 * mark is visible even where the color encoding alone would not be.
 */
export function PlddtStrip({ model, position }: PlddtStripProps) {
  const points = useMemo(
    () => model.points.filter((p) => p.plddt !== null && p.plddt !== undefined),
    [model.points],
  );
  const indexOfPosition = useMemo(() => {
    if (position === undefined) return -1;
    return points.findIndex((p) => p.resi === position);
  }, [points, position]);

  if (points.length === 0) return null;

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <svg
          width={points.length * BAR_W}
          height={BAR_H + 14}
          role="img"
          aria-label="Per-residue pLDDT confidence strip"
        >
          {points.map((p, i) => (
            <rect
              key={`${p.chain}:${p.resi}`}
              x={i * BAR_W}
              y={4}
              width={BAR_W - 0.6}
              height={BAR_H}
              rx={0.8}
              fill={plddtBand(p.plddt as number).color}
            >
              <title>{`${p.resn}${p.resi} · pLDDT ${(p.plddt as number).toFixed(1)}`}</title>
            </rect>
          ))}
          {indexOfPosition >= 0 && (
            <g>
              <line
                x1={indexOfPosition * BAR_W + BAR_W / 2}
                x2={indexOfPosition * BAR_W + BAR_W / 2}
                y1={0}
                y2={BAR_H + 4}
                stroke="#e6edf7"
                strokeWidth={1.2}
              />
              <text
                x={Math.min(indexOfPosition * BAR_W + BAR_W / 2, points.length * BAR_W - 70)}
                y={BAR_H + 12}
                fontSize={9}
                fill="#e6edf7"
                className="stat-num"
              >
                {position}
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
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
    </div>
  );
}
