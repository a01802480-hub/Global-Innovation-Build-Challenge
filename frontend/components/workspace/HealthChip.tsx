"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { STATUS } from "@/lib/format";

type Health = { status: "ok"; services: Record<string, boolean> } | null;

/** Live backend health chip — polls /api/health once on mount. */
export function HealthChip() {
  const [health, setHealth] = useState<Health>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ status: string; services: Record<string, boolean> }>("/health")
      .then((h) => {
        if (!cancelled) setHealth(h as Health);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <span className="chip border-[#d03b3b]/40 text-[#e66767]">
        <Dot color="#d03b3b" /> API unreachable
      </span>
    );
  }
  if (!health) {
    return (
      <span className="chip">
        <span className="skeleton h-1.5 w-1.5 rounded-full" /> checking API…
      </span>
    );
  }
  const services = Object.values(health.services).filter(Boolean).length;
  return (
    <span className="chip">
      <Dot color={STATUS.good} />
      API online · {services} upstream services
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 rounded-full"
      style={{ background: color, boxShadow: `0 0 8px ${color}88` }}
    />
  );
}
