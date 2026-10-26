export interface CompilerObservation {
  id: string;
  phase: "queued" | "spawned" | "exited" | "rejected";
  at: number;
  pid?: number;
  exitCode?: number;
  cancelled?: boolean;
  cpuMicros?: number;
  peakRssBytes?: number;
  resourceObservation?: "kernel_exit_usage" | "unavailable";
  failureCode?: string;
}

export const compilerResourceObservation = (
  usage: { cpuTime: { total: number | bigint }; maxRSS: number } | undefined,
) => {
  // Bun can return an all-zero usage structure on Windows. A compiler cannot
  // have zero peak RSS; these fields must not train a zero-cost estimate.
  if (!usage || usage.maxRSS <= 0) return { resourceObservation: "unavailable" as const };
  return {
    cpuMicros: Number(usage.cpuTime.total),
    peakRssBytes: usage.maxRSS,
    resourceObservation: "kernel_exit_usage" as const,
  };
};

const listeners = new Set<(event: CompilerObservation) => void>();

// Maintainer diagnostics contain timing and resource facts, never source code or environment values.
export const subscribeExtensionCompilers = (listener: (event: CompilerObservation) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const observeExtensionCompiler = (event: CompilerObservation) => {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Observers must never interrupt spawning, reaping, or slot release.
    }
  }
};
