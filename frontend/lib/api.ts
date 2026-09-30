"use client";

/**
 * API client for the BioStream backend.
 *
 * Security notes (see README Security Audit):
 * - `credentials: "include"` so the backend's SameSite=Lax CSRF cookie flows.
 * - Every state-changing request echoes that cookie back as `X-CSRF-Token`
 *   (double-submit CSRF). On a 403 (e.g. first visit before the cookie exists)
 *   we refresh via a safe GET and retry exactly once.
 * - Nothing secret lives client-side: only the backend base URL is public.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function doFetch<T>(path: string, init: RequestInit): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body) headers["Content-Type"] = "application/json";
  if (method !== "GET" && method !== "HEAD") {
    const token = readCookie("biostream_csrf");
    if (token) headers["X-CSRF-Token"] = token;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  try {
    return await doFetch<T>(path, init);
  } catch (err) {
    const mutating = method !== "GET" && method !== "HEAD";
    if (mutating && err instanceof ApiError && err.status === 403) {
      // First visit: no CSRF cookie yet. A safe GET issues one; retry once.
      await doFetch("/health", { method: "GET" });
      return await doFetch<T>(path, init);
    }
    throw err;
  }
}
