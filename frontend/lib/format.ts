/** Formatting + color-scale helpers for sequences, pLDDT and writhe. */

export function chunkString(s: string, size = 60): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

export function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** AlphaFold standard pLDDT confidence bands (domain-standard colors + labels). */
export function plddtBand(v: number): { label: string; color: string; range: string } {
  if (v >= 90) return { label: "Very high", color: "#0053d6", range: "90–100" };
  if (v >= 70) return { label: "Confident", color: "#65cbf3", range: "70–90" };
  if (v >= 50) return { label: "Low", color: "#ffdb13", range: "50–70" };
  return { label: "Very low", color: "#ff7d45", range: "<50" };
}

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lerp(a: RGB, b: RGB, t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const WRITHE_NEG: RGB = hexToRgb("#8b5cf6"); // negative twist → violet
const WRITHE_ZERO: RGB = hexToRgb("#64748b"); // ~0 → neutral slate
const WRITHE_POS: RGB = hexToRgb("#22d3ee"); // positive twist → cyan

/** Diverging scale for local writhe, symmetric about 0 (two hues + gray midpoint). */
export function writheColor(v: number, extent: number): string {
  const t = Math.max(-1, Math.min(1, v / Math.max(extent, 1e-6)));
  return t < 0 ? lerp(WRITHE_ZERO, WRITHE_NEG, -t) : lerp(WRITHE_ZERO, WRITHE_POS, t);
}

/** Categorical order for InterPro entry types (validator-passed, CVD-safe). */
const DOMAIN_COLORS: Record<string, string> = {
  domain: "#0284c7",
  family: "#8b5cf6",
  repeat: "#d97706",
  homologous_superfamily: "#f43f5e",
};

export function domainColor(type: string): string {
  return DOMAIN_COLORS[type] ?? "#f43f5e";
}

/** "Other" entry types get a texture overlay as secondary encoding. */
export function domainIsOther(type: string): boolean {
  return !(type in DOMAIN_COLORS) || type === "homologous_superfamily";
}
