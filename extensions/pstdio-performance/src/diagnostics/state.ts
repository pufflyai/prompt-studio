interface DiagnosticRuntimeState {
  active?: string;
  writes: Map<string, Promise<unknown>>;
}

// Reloaded extension copies and different projects share one backend profiler.
const key = Symbol.for("pstdio.performance.runtime-diagnostics");
const runtime = globalThis as typeof globalThis & { [key]?: DiagnosticRuntimeState };
runtime[key] ??= { writes: new Map() };
export const diagnosticRuntime = runtime[key];

export const serializeDiagnosticWrite = <T>(directory: string, work: () => Promise<T>) => {
  const previous = diagnosticRuntime.writes.get(directory) ?? Promise.resolve();
  const next = previous.then(work, work);
  diagnosticRuntime.writes.set(directory, next);
  const release = () => {
    if (diagnosticRuntime.writes.get(directory) === next) diagnosticRuntime.writes.delete(directory);
  };
  void next.then(release, release);
  return next;
};
