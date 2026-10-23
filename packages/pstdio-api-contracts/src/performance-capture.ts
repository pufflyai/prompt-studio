/** A missing reading is unavailable, never a healthy zero. CPU uses one core = 100%. */
export interface PerformanceProcessSample {
  pid: number;
  processStartId: string;
  role: "backend" | "main" | "gpu" | "utility" | "workbench" | "startup" | "extension-frames" | "renderer" | "other";
  cpuPercent: number | null;
  cpuTimeMs: number | null;
  residentBytes: number;
  peakResidentBytes: number | null;
  physicalFootprintBytes: number | null;
  peakPhysicalFootprintBytes: number | null;
  privateCommittedBytes: number | null;
  heapUsedBytes: number | null;
  externalBytes: number | null;
}

export interface PerformanceRuntimeReading {
  pid: number;
  heapUsedBytes: number;
  externalBytes: number;
  counters: {
    activeSessions: number;
    retainedMessages: number;
    subscribers: number;
    queuedEvents: number;
    queuedBytes: number;
    extensionImports: number;
  };
}

export interface PerformanceResponseSample {
  runtimeId: string | null;
  scope: "local" | "remote" | "unavailable";
  state: "reply" | "timeout" | "unavailable";
  /** A timeout is censored, and must not enter response-time percentiles. */
  durationMs: number | null;
  observedForMs: number;
  runtime: PerformanceRuntimeReading | null;
}

export interface PerformanceCaptureSample {
  sequence: number;
  capturedAt: string;
  elapsedMs: number;
  /** Actual sampling gap. Consumers can detect missing coverage without assuming a fixed clock. */
  intervalMs: number | null;
  processes: PerformanceProcessSample[];
  backend: PerformanceResponseSample;
}

export interface PerformanceCapture {
  version: 2;
  id: string;
  startedAt: string;
  hostVersion: string;
  platform: string;
  sampleIntervalMs: number;
  /** Full startup samples remain in the bounded recording after leaving this live window. */
  samples: PerformanceCaptureSample[];
  droppedSamples: number;
}
