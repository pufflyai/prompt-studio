import type { PerformanceResponseSample } from "pstdio-api-contracts/performance-diagnostics";

import { readRuntimeDiagnostics } from "./runtime-reading";

export interface PerformanceBackend {
  id: string | null;
  pid: number | null;
  origin: string | null;
  token: string | null;
  scope: "local" | "remote";
}

export const measureBackendResponse = async (
  backend: PerformanceBackend | null,
  signal: AbortSignal,
  timeoutMs: number,
) => {
  const started = performance.now();
  const identity = { runtimeId: backend?.id ?? null, scope: backend?.scope ?? "unavailable" } as const;
  if (!backend?.origin || !backend.token) {
    return {
      ...identity,
      state: "unavailable",
      durationMs: null,
      observedForMs: 0,
      runtime: null,
    } satisfies PerformanceResponseSample;
  }
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  try {
    const response = await fetch(new URL("/diagnostics/performance", backend.origin), {
      headers: { Authorization: `Bearer ${backend.token}` },
      signal: AbortSignal.any([signal, timeout.signal]),
    });
    const runtime = response.ok ? await readRuntimeDiagnostics(response) : null;
    if (!response.ok) await response.body?.cancel();
    const durationMs = performance.now() - started;
    return {
      ...identity,
      state: response.ok ? "reply" : "unavailable",
      durationMs: response.ok ? durationMs : null,
      observedForMs: durationMs,
      runtime,
    } satisfies PerformanceResponseSample;
  } catch {
    signal.throwIfAborted();
    return {
      ...identity,
      state: timeout.signal.aborted ? "timeout" : "unavailable",
      durationMs: null,
      observedForMs: performance.now() - started,
      runtime: null,
    } satisfies PerformanceResponseSample;
  } finally {
    clearTimeout(timer);
  }
};
