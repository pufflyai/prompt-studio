export interface CompilerObservation {
  id: string;
  phase: "queued" | "spawned" | "exited" | "rejected";
  at: number;
  pid?: number;
  exitCode?: number;
  cancelled?: boolean;
  cpuMicros?: number;
  peakRssBytes?: number;
  failureCode?: string;
}

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
