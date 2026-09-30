import type { OrthologInfo } from "@/lib/types";
import { fmt } from "@/lib/format";

/** Ortholog summary — graceful "unavailable" state with the upstream detail. */
export function OrthologCard({ ortholog }: { ortholog: OrthologInfo }) {
  if (!ortholog.available) {
    return (
      <div className="rounded-lg border border-white/5 bg-ink-950/40 px-4 py-6">
        <p className="text-sm font-medium text-frost/90">Whale ortholog unavailable</p>
        <p className="mt-1 text-xs leading-relaxed text-mist/70">
          {ortholog.detail ?? "No ortholog found among the candidate cetacean species."}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-frost/90">{ortholog.species_label}</span>
        <span className="chip">
          {ortholog.orthology_type?.replace(/_/g, " ") ?? "ortholog"}
        </span>
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-mist/70">Ensembl protein</dt>
          <dd className="stat-num font-mono text-xs text-frost/90">{ortholog.protein_id ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-mist/70">Percent identity</dt>
          <dd className="stat-num font-medium" style={{ color: ortholog.percent_identity !== undefined && ortholog.percent_identity >= 80 ? "#0ca30c" : "#e8b64c" }}>
            {ortholog.percent_identity !== undefined ? `${fmt(ortholog.percent_identity, 1)}%` : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-mist/70">Sequence</dt>
          <dd className="text-xs text-frost/90">
            {ortholog.sequence ? `${ortholog.sequence.length} aa` : "not fetched"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
