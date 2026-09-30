/** Backbone-tube geometry for the R3F structure viewer.
 *
 * A smooth Catmull-Rom spline is sampled through the Cα trace; a ring of
 * vertices is built at every sample using discrete parallel transport of the
 * frame (project the previous normal off the new tangent), and per-residue
 * colors are interpolated along the bond. One draw call per chain.
 */
import * as THREE from "three";

export type Vec3 = [number, number, number];

export interface Bounds {
  center: Vec3;
  radius: number;
}

export function computeBounds(points: Vec3[]): Bounds {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const [x, y, z] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const center: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  let radius = 0;
  for (const p of points) {
    const d = Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]);
    if (d > radius) radius = d;
  }
  return { center, radius };
}

/** Center the trace on the origin and scale it to a fixed max radius. */
export function normalizePoints(points: Vec3[], targetRadius = 8): Vec3[] {
  return points.map(fitTransform(points, targetRadius));
}

/**
 * Return the centering+scaling transform for a trace. Marker coordinates
 * (active-site residues, metals) live in the same PDB frame as the trace but
 * are not part of it, so they must be pushed through this same transform.
 */
export function fitTransform(points: Vec3[], targetRadius = 8): (p: Vec3) => Vec3 {
  const { center, radius } = computeBounds(points);
  if (radius < 1e-6) return (p) => p;
  const s = targetRadius / radius;
  return (p) => [
    (p[0] - center[0]) * s,
    (p[1] - center[1]) * s,
    (p[2] - center[2]) * s,
  ];
}

function _v(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p[0], p[1], p[2]);
}

function _set(vec: THREE.Vector3, out: Vec3): Vec3 {
  out[0] = vec.x;
  out[1] = vec.y;
  out[2] = vec.z;
  return out;
}

export function buildBackboneGeometry(
  points: Vec3[],
  colors: Vec3[],
  radius = 0.16,
  radialSegments = 7,
  segmentsPerBond = 5,
): THREE.BufferGeometry {
  const n = points.length;
  if (n < 2) return new THREE.BufferGeometry();

  const curve = new THREE.CatmullRomCurve3(points.map(_v), false, "catmullrom", 0.5);
  const bondCount = n - 1;
  const sampleCount = bondCount * segmentsPerBond;

  const positions: number[] = [];
  const normals: number[] = [];
  const vertexColors: number[] = [];
  const indices: number[] = [];

  // First frame: pick any reference vector not parallel to the tangent.
  const t0 = _set(curve.getTangentAt(0), [0, 0, 0]);
  const up: THREE.Vector3 =
    Math.abs(t0[1]) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let prevN = new THREE.Vector3().crossVectors(new THREE.Vector3(t0[0], t0[1], t0[2]), up).normalize();

  const pos = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let s = 0; s <= sampleCount; s++) {
    curve.getPointAt(s / sampleCount, pos);
    curve.getTangentAt(s / sampleCount, tangent);

    // Discrete parallel transport: strip the tangent component off the
    // previous normal, then re-orthonormalize.
    prevN.sub(tangent.clone().multiplyScalar(prevN.dot(tangent))).normalize();
    binormal.crossVectors(tangent, prevN).normalize();
    normal.copy(prevN);

    const colorIndex = Math.min(bondCount - 1, Math.floor(s / segmentsPerBond));
    const frac = s / segmentsPerBond - Math.floor(s / segmentsPerBond);
    const ca = colors[colorIndex];
    const cb = colors[Math.min(bondCount, colorIndex + 1)];
    const cr = Math.round(ca[0] + (cb[0] - ca[0]) * frac);
    const cg = Math.round(ca[1] + (cb[1] - ca[1]) * frac);
    const cb2 = Math.round(ca[2] + (cb[2] - ca[2]) * frac);

    for (let k = 0; k < radialSegments; k++) {
      const angle = (2 * Math.PI * k) / radialSegments;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      positions.push(
        pos.x + radius * (cos * normal.x + sin * binormal.x),
        pos.y + radius * (cos * normal.y + sin * binormal.y),
        pos.z + radius * (cos * normal.z + sin * binormal.z),
      );
      normals.push(cos * normal.x + sin * binormal.x, cos * normal.y + sin * binormal.y, cos * normal.z + sin * binormal.z);
      vertexColors.push(cr / 255, cg / 255, cb2 / 255);
    }
  }

  for (let s = 0; s < sampleCount; s++) {
    const a = s * radialSegments;
    const b = (s + 1) * radialSegments;
    for (let k = 0; k < radialSegments; k++) {
      const k2 = (k + 1) % radialSegments;
      indices.push(a + k, b + k, b + k2, a + k, b + k2, a + k2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  geo.setIndex(indices);
  return geo;
}

/** Deterministic PRNG so the hero scene looks identical across reloads. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
