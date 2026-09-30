/** Formatting + color-scale helpers for sequences, pLDDT and writhe.
 *
 * Color notes (validated 2026-09-30 with the dataviz palette validator,
 * dark surface):
 * - Domain type colors are the validated dark categorical slots, fixed order
 *   (domain→family→repeat→homologous_superfamily→other). "Other" additionally
 *   carries a texture overlay as secondary encoding.
 * - Writhe uses a diverging pair (violet / blue dark slots) with a neutral
 *   gray midpoint; the sign is always also shown numerically.
 * - pLDDT keeps the canonical AlphaFold band colors (a domain convention in
 *   structural biology); they fail generic sequential-ramp validation, so
 *   every pLDDT color is always accompanied by a text label and a legend.
 * - Status colors (good/warning/serious/critical) are fixed and never reused
 *   as series colors; they always ship with an icon + label.
 */

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

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lerpTuple(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function lerpCss(a: RGB, b: RGB, t: number): string {
  const c = lerpTuple(a, b, t);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/* Validated dark categorical slots (diverging pair for the writhe scale). */
const WRITHE_NEG: RGB = hexToRgb("#9085e9"); // negative twist → violet
const WRITHE_ZERO: RGB = hexToRgb("#6b7280"); // ~0 → neutral slate
const WRITHE_POS: RGB = hexToRgb("#3987e5"); // positive twist → blue

function writheT(v: number, extent: number): number {
  return Math.max(-1, Math.min(1, v / Math.max(extent, 1e-6)));
}

/** RGB tuple for the 3D viewer (writhe color mode). */
export function writheColorRgb(v: number, extent: number): RGB {
  const t = writheT(v, extent);
  return t < 0 ? lerpTuple(WRITHE_ZERO, WRITHE_NEG, -t) : lerpTuple(WRITHE_ZERO, WRITHE_POS, t);
}

/** Diverging scale for local writhe, symmetric about 0 (two hues + gray midpoint). */
export function writheColor(v: number, extent: number): string {
  const t = writheT(v, extent);
  return t < 0 ? lerpCss(WRITHE_ZERO, WRITHE_NEG, -t) : lerpCss(WRITHE_ZERO, WRITHE_POS, t);
}

/** Categorical order for InterPro entry types (validator-passed dark slots). */
const DOMAIN_COLORS: Record<string, string> = {
  domain: "#3987e5",
  family: "#d95926",
  repeat: "#199e70",
  homologous_superfamily: "#c98500",
};

/** "Other" entry types get the `domain-other-fill` texture as secondary encoding. */
export function domainIsOther(type: string): boolean {
  return !(type in DOMAIN_COLORS);
}

export function domainColor(type: string): string {
  return DOMAIN_COLORS[type] ?? "#d55181";
}

/** Fixed status palette — good / warning / serious / critical. Never themed,
 *  never reused as series colors, always paired with an icon + label. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/** Active-site marker colors (validated categorical slots, distinct from status). */
export const MARKER = {
  residue: "#c98500", // active-site residue sphere
  metal: "#199e70", // metal ion (Mg²⁺ …)
} as const;
