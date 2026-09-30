"use client";

/**
 * Interactive R3F structure viewer.
 *
 * Renders the backend's downsampled Cα trace as a smooth vertex-colored tube
 * (one draw call). Color modes: chain identity, per-residue pLDDT (canonical
 * AlphaFold bands), and local backbone writhe (validated diverging scale).
 * Active-site residues and metal ions are marked with spheres + glass labels;
 * their coordinates are transformed with the same fit as the trace.
 */
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import {
  buildBackboneGeometry,
  fitTransform,
  normalizePoints,
  type Vec3,
} from "@/lib/geometry";
import { MARKER, hexToRgb, plddtBand, writheColorRgb } from "@/lib/format";
import type { StructureModel } from "@/lib/types";

export type ColorMode = "chain" | "plddt" | "writhe";

interface ProteinViewerProps {
  model: StructureModel;
  colorMode: ColorMode;
  showActiveSite: boolean;
  showMetals: boolean;
}

const CHAIN_PALETTE: [number, number, number][] = [
  hexToRgb("#3987e5"),
  hexToRgb("#d95926"),
  hexToRgb("#199e70"),
  hexToRgb("#c98500"),
  hexToRgb("#d55181"),
  hexToRgb("#9085e9"),
];
const GRAY: Vec3 = [107, 114, 128];

function colorForPoint(
  p: StructureModel["points"][number],
  index: number,
  mode: ColorMode,
  model: StructureModel,
): Vec3 {
  if (mode === "chain") {
    return CHAIN_PALETTE[p.chain.charCodeAt(0) % CHAIN_PALETTE.length];
  }
  if (mode === "plddt") {
    if (p.plddt === null || p.plddt === undefined) return GRAY;
    return hexToRgb(plddtBand(p.plddt).color);
  }
  const extent = model.local_writhe?.length
    ? Math.max(0.05, ...model.local_writhe.map((v) => Math.abs(v)))
    : 0.05;
  return writheColorRgb(model.local_writhe?.[index] ?? 0, extent);
}

function Backbone({ model, colorMode }: { model: StructureModel; colorMode: ColorMode }) {
  const geometry = useMemo(() => {
    const coords = model.points.map((p) => [p.x, p.y, p.z] as Vec3);
    const colors = model.points.map((p, i) => colorForPoint(p, i, colorMode, model));
    return buildBackboneGeometry(normalizePoints(coords), colors);
  }, [model, colorMode]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.3} metalness={0.08} />
    </mesh>
  );
}

function Markers({ model, showActiveSite, showMetals }: ProteinViewerProps) {
  const traceCoords = useMemo(
    () => model.points.map((p) => [p.x, p.y, p.z] as Vec3),
    [model.points],
  );
  const fit = useMemo(() => fitTransform(traceCoords), [traceCoords]);

  const residueMarkers = useMemo(() => {
    if (!showActiveSite) return [];
    const out: { key: string; pos: Vec3; label: string }[] = [];
    const seen = new Set<string>();
    for (const site of model.active_sites ?? []) {
      for (const r of site.residues) {
        if (r.x === undefined || r.x === null || r.y == null || r.z == null) continue;
        // The same residue appears in several SITE records (e.g. 8RUC lists
        // ASP 203 in many sites) — one marker per residue.
        const dedupeKey = `${r.chain}:${r.resi}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        out.push({
          key: `${site.site_id}:${r.chain}:${r.resi}`,
          pos: fit([r.x, r.y, r.z]),
          label: `${r.resname} ${r.resi}`,
        });
      }
    }
    return out;
  }, [model, fit, showActiveSite]);

  const metalMarkers = useMemo(() => {
    if (!showMetals) return [];
    return (model.metals ?? []).map((m) => ({
      key: `${m.element}:${m.chain}:${m.resi}`,
      pos: fit([m.x, m.y, m.z]),
      label: `${m.element}${m.element.length === 1 ? "⁺" : "²⁺"}`,
    }));
  }, [model, fit, showMetals]);

  return (
    <>
      {residueMarkers.map((m) => (
        <group key={m.key} position={m.pos}>
          <mesh>
            <sphereGeometry args={[0.34, 16, 16]} />
            <meshStandardMaterial color={MARKER.residue} emissive={MARKER.residue} emissiveIntensity={0.35} roughness={0.25} />
          </mesh>
          <Html center distanceFactor={16} zIndexRange={[10, 0]}>
            <span className="marker-label">{m.label}</span>
          </Html>
        </group>
      ))}
      {metalMarkers.map((m) => (
        <group key={m.key} position={m.pos}>
          <mesh>
            <sphereGeometry args={[0.5, 20, 20]} />
            <meshStandardMaterial color={MARKER.metal} emissive={MARKER.metal} emissiveIntensity={0.45} roughness={0.15} metalness={0.4} />
          </mesh>
          <Html center distanceFactor={16} zIndexRange={[10, 0]}>
            <span className="marker-label marker-label-metal">{m.label}</span>
          </Html>
        </group>
      ))}
    </>
  );
}

export default function ProteinViewer(props: ProteinViewerProps) {
  const { model, colorMode } = props;
  return (
    <Canvas
      camera={{ position: [0, 5, 15], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <fog attach="fog" args={["#05070f", 26, 60]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 12, 8]} intensity={1.5} />
      <directionalLight position={[-8, -6, -4]} intensity={0.5} color="#a78bfa" />
      <Backbone model={model} colorMode={colorMode} />
      <Markers {...props} />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
        minDistance={6}
        maxDistance={34}
      />
    </Canvas>
  );
}
