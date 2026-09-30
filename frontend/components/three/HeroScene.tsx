"use client";

/**
 * Decorative hero canvas: a synthetic protein-like ribbon floating in a dust
 * cloud. Deterministic (seeded PRNG), transform-only motion, static under
 * `prefers-reduced-motion`. Rendered behind the landing headline at a lower
 * parallax rate than the foreground content.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildBackboneGeometry, mulberry32, type Vec3 } from "@/lib/geometry";
import { usePrefersReducedMotion } from "@/lib/motion";

function gradientColor(u: number): Vec3 {
  // cyan → violet → pink sweep along the ribbon (brand gradient, not data).
  const stops: [number, Vec3][] = [
    [0, [34, 211, 238]],
    [0.55, [167, 139, 250]],
    [1, [244, 114, 182]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [u0, c0] = stops[i];
    const [u1, c1] = stops[i + 1];
    if (u <= u1) {
      const t = (u - u0) / (u1 - u0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

function syntheticRibbon(): { points: Vec3[]; colors: Vec3[] } {
  const rng = mulberry32(20260930);
  const points: Vec3[] = [];
  const colors: Vec3[] = [];
  const n = 240;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const t = u * Math.PI * 6;
    const wob = (rng() - 0.5) * 0.9;
    const x = 2.6 * Math.cos(t) + 0.55 * Math.sin(t * 1.7) * wob;
    const y = 2.6 * Math.sin(t) + 0.55 * Math.cos(t * 1.3) * wob;
    const z = (u - 0.5) * 15 + 0.45 * Math.sin(t * 2.1);
    points.push([x, y, z]);
    colors.push(gradientColor(u));
  }
  return { points, colors };
}

function Ribbon() {
  const { points, colors } = useMemo(syntheticRibbon, []);
  const geometry = useMemo(() => buildBackboneGeometry(points, colors, 0.085, 6, 4), [points, colors]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.32} metalness={0.18} />
    </mesh>
  );
}

function Dust() {
  const positions = useMemo(() => {
    const rng = mulberry32(42);
    const arr = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      // roughly spherical shell around the ribbon
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = 9 + rng() * 9;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi) * 0.6;
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        color="#8fa3bf"
        transparent
        opacity={0.45}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function SlowSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const reduced = usePrefersReducedMotion();
  useFrame((_, delta) => {
    if (!reduced && ref.current) ref.current.rotation.y += delta * 0.1;
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroScene() {
  return (
    <div className="absolute inset-0" aria-hidden>
      <Canvas camera={{ position: [0, 0.5, 17], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[8, 10, 6]} intensity={1.3} />
        <directionalLight position={[-10, -4, -6]} intensity={0.5} color="#a78bfa" />
        <SlowSpin>
          <Ribbon />
          <Dust />
        </SlowSpin>
      </Canvas>
    </div>
  );
}
