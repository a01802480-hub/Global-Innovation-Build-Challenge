export interface CatalogEntry {
  id: string;
  pdb: string;
  title: string;
  note: string;
}

export interface StructurePoint {
  resn: string;
  resi: number;
  chain: string;
  x: number;
  y: number;
  z: number;
  plddt: number | null;
}

export interface ActiveSiteResidue {
  resname: string;
  chain: string;
  resi: number;
  /** Exact Cα coordinates (PDB frame) — attached server-side. */
  x?: number | null;
  y?: number | null;
  z?: number | null;
}

export interface ActiveSite {
  site_id: string;
  residues: ActiveSiteResidue[];
}

export interface Metal {
  element: string;
  resi: number;
  chain: string;
  x: number;
  y: number;
  z: number;
}

export interface StructureModel {
  source: "rcsb" | "alphafold";
  pdb_id?: string | null;
  uniprot?: string;
  title: string;
  chains: string[];
  primary_chain: string;
  residue_count: number;
  full_residue_count?: number;
  points: StructurePoint[];
  writhe: number | null;
  local_writhe: number[];
  active_sites: ActiveSite[];
  metals: Metal[];
  mean_plddt?: number;
}

export interface AlignmentResult {
  aligned_a: string;
  aligned_b: string;
  score: number;
  identity_pct: number;
  matches: number;
  mismatches: number;
  gaps: number;
  length: number;
}

export interface UniProtEntry {
  accession: string;
  gene: string | null;
  name: string | null;
  organism: string | null;
  length: number | null;
  sequence: string | null;
}

export interface OrthologInfo {
  available: boolean;
  species?: string;
  species_label?: string;
  protein_id?: string;
  percent_identity?: number;
  orthology_type?: string;
  sequence?: string | null;
  detail?: string;
}

export interface InterProDomain {
  accession: string;
  name: string;
  type: string;
  start: number;
  end: number;
}

export interface GeneDashboard {
  gene: string;
  human: UniProtEntry;
  ortholog: OrthologInfo;
  domains: InterProDomain[];
}

export type SourceStatus = "ok" | "unavailable" | "timeout";

export interface SourceResult {
  status: SourceStatus;
  detail?: string;
  [key: string]: unknown;
}

export interface VariantImpact {
  uniprot_id: string;
  gene: string | null;
  variant: string;
  plddt: SourceResult & { plddt?: number; mean_model_plddt?: number };
  alphamissense: SourceResult & { class?: string; mean_pathogenicity?: number };
  sift: SourceResult & {
    hgvs?: string;
    sift?: { score: number; prediction: string } | null;
    polyphen?: { score: number; prediction: string } | null;
  };
}
