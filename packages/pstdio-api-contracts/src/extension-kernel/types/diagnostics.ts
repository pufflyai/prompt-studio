/** Memory of the profiled host process, in bytes, as reported by `process.memoryUsage()`. */
export interface BackendDiagnosticMemory {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

/** A V8 CPU profile, as returned by the inspector's `Profiler.stop`. */
export interface BackendCpuProfile {
  nodes: {
    id: number;
    callFrame: { functionName: string; scriptId: string; url: string; lineNumber: number; columnNumber: number };
    hitCount?: number;
    children?: number[];
    deoptReason?: string;
    positionTicks?: { line: number; ticks: number }[];
  }[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
}

/** Precise function-call coverage of one script, as returned by the inspector's `Profiler.takePreciseCoverage`. */
export interface BackendScriptCoverage {
  scriptId: string;
  url: string;
  functions: {
    functionName: string;
    ranges: { startOffset: number; endOffset: number; count: number }[];
    isBlockCoverage: boolean;
  }[];
}

/**
 * One host runtime operation published on the `pstdio.diagnostics.operation` channel. Only the
 * documented bounded fields are copied; SQL text, parameters and content are never included.
 */
export interface BackendOperationEvent {
  kind: string;
  startedAt: string;
  durationMs: number;
  origin?: { kind: string; name: string; id?: string; projectId?: string };
  id?: string;
  parentId?: string;
  queryHash?: string;
  statement?: string;
  caller?: string;
  sessionId?: string;
  rows?: number;
  bytes?: number;
  logicalBytes?: number;
  wireBytes?: number;
  fragments?: number;
  revision?: number;
  failed?: boolean;
  complete?: boolean;
}

/** The host operations seen during a capture: the latest 60 seconds, at most 1,000 events and 512 KiB. */
export interface BackendOperationTrace {
  channel: string;
  events: BackendOperationEvent[];
  dropped: number;
  bytes: number;
}

/** The most frequent functions of a capture: CPU samples, or function calls for coverage. */
export interface BackendDiagnosticSummary {
  durationMs: number;
  unit: "samples" | "calls";
  total: number;
  /** At most 20 functions, most frequent first. */
  top: { name: string; location: string; count: number }[];
  memoryBefore: BackendDiagnosticMemory;
  memoryAfter: BackendDiagnosticMemory;
}

export interface BackendProfileCaptureData {
  kind: "cpu" | "coverage";
  pid: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  memoryBefore: BackendDiagnosticMemory;
  memoryAfter: BackendDiagnosticMemory;
  operations: BackendOperationTrace;
  /** Present for `cpu` captures. */
  profile?: BackendCpuProfile;
  /** Present for `coverage` captures. */
  coverage?: BackendScriptCoverage[];
}

/** CPU use of the host process over one interval, as a percentage of one core. */
export interface BackendCpuReading {
  capturedAt: string;
  intervalMs: number;
  cpuPercent: number;
}

export interface BackendArmedCaptureData {
  kind: "cpu";
  mode: "armed";
  pid: number;
  runtime: { bunVersion: string; platform: string; architecture: string };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** False in the checkpoints written while the capture is still watching. */
  complete: boolean;
  reason: "recording" | "threshold" | "expired";
  thresholdCpuPercent: number;
  /** The reading that reached the threshold. */
  trigger?: BackendCpuReading;
  cpu: BackendCpuReading[];
  /** The latest two profile windows of about 30 seconds each. */
  profiles: { startedAt: string; finishedAt: string; profile: BackendCpuProfile }[];
  discardedProfileWindows: number;
  /** Checkpoints replaced by a newer one while an earlier write was still running. */
  skippedCheckpoints: number;
  operations: BackendOperationTrace;
  memoryBefore: BackendDiagnosticMemory;
  memoryAfter: BackendDiagnosticMemory;
}

export type BackendDiagnosticCaptureInput =
  | {
      /** `cpu` records a CPU profile; `coverage` counts function calls. */
      kind: "cpu" | "coverage";
      /** At most 60,000 ms. */
      durationMs: number;
      signal?: AbortSignal;
    }
  | {
      /** Watches host CPU and keeps profiling, so the profile around the first spike is retained. */
      kind: "armed";
      /** How long to watch. At most 24 hours. */
      durationMs: number;
      /** Stops when one sample reaches this CPU use, as a percentage of one core (up to 10,000). */
      cpuPercent: number;
      /**
       * Receives the evidence after each completed profile window and at the end, so it survives a
       * host that stops mid-capture. Writes run one at a time; a newer checkpoint replaces one that
       * is still waiting. A rejected checkpoint fails the capture. The host allows 30 seconds for
       * final checkpoint writes after recording ends.
       */
      checkpoint?: (data: BackendArmedCaptureData) => Promise<void> | void;
      signal?: AbortSignal;
    };

export type BackendDiagnosticCaptureResult<
  TInput extends BackendDiagnosticCaptureInput = BackendDiagnosticCaptureInput,
> = {
  summary: BackendDiagnosticSummary;
  data: TInput extends { kind: "armed" } ? BackendArmedCaptureData : BackendProfileCaptureData;
};

/**
 * Profiles the Prompt Studio API process, which runs host services and routes, and traces its
 * runtime operations. Extension backends run in their own workers and are not profiled.
 *
 * Only first-party Prompt Studio extensions may capture; other extensions get `diagnostics_forbidden`.
 * One recording uses the profiler at a time. An overlapping recording gets `diagnostics_busy`. Aborting `signal`, or
 * cancelling the invocation, stops the profiler and rejects.
 */
export interface ExtensionDiagnosticsApi {
  capture<TInput extends BackendDiagnosticCaptureInput>(input: TInput): Promise<BackendDiagnosticCaptureResult<TInput>>;
}
