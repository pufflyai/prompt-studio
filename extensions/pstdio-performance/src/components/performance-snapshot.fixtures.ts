import type { PerformanceCaptureSample, PerformanceProcessSample, PerformanceSnapshot } from "@pstdio/sdk/extensions";

type PerformanceProcess = PerformanceSnapshot["processes"][number];

const process = (
  input: Partial<PerformanceProcess> & Pick<PerformanceProcess, "pid" | "role">,
): PerformanceProcess => ({
  name: null,
  extensionFrames: [],
  cpuPercent: 0,
  averageCpuPercent: null,
  sustainedHighCpu: false,
  idleWakeupsPerSecond: 2,
  memoryKiB: { workingSet: 82_000, peakWorkingSet: 96_000, privateBytes: null },
  ...input,
});

// One process per extension, so the stories show one row each. Webview ids carry the extension name.
const extension = (pid: number, name: string, cpu: number, views = 1, workingSet = 80_000) =>
  process({
    pid,
    role: "extension-frames",
    cpuPercent: cpu,
    averageCpuPercent: cpu,
    extensionFrames: Array.from({ length: views }, (_, index) => ({
      installedExtensionId: `installed-${name}`,
      webviewId: `pstdio.${name}.view.view-${index + 1}`,
    })),
    memoryKiB: { workingSet, peakWorkingSet: workingSet, privateBytes: null },
  });

const frames: PerformanceSnapshot["frames"] = [
  {
    startedAt: "2026-10-02T12:04:31.000Z",
    durationMs: 182,
    blockingDurationMs: 132,
    scripts: [
      {
        invokerType: "resolve-promise",
        invoker: "Promise.then",
        source: "index-4f2a.js",
        functionName: "flush",
        durationMs: 160,
      },
    ],
  },
  {
    startedAt: "2026-10-02T12:04:29.000Z",
    durationMs: 96,
    blockingDurationMs: 46,
    scripts: [
      {
        invokerType: "user-callback",
        invoker: "FrameRequestCallback",
        source: "chat-ui-1c9e.js",
        functionName: "render",
        durationMs: 71,
      },
    ],
  },
];

export const smoothFrameRate = [
  60, 60, 59, 60, 60, 58, 60, 60, 60, 57, 60, 60, 60, 59, 60, 60, 55, 60, 60, 60, 58, 60, 60, 60, 59, 60, 60, 57, 60,
  60,
];
export const loadFrameRate = [
  60, 59, 60, 58, 52, 44, 38, 41, 47, 39, 36, 44, 40, 22, 28, 35, 41, 38, 33, 30, 36, 44, 39, 31, 29, 35, 38, 33, 36,
  34,
];

const base: PerformanceSnapshot = {
  version: 1,
  host: "desktop",
  capturedAt: "2026-10-02T12:04:32.000Z",
  sampleIntervalMs: 2_000,
  warning: { windowMs: 30_000, cpuPercent: 80 },
  measurementWindowMs: 2_000,
  capabilities: { processMetrics: true, idleWakeups: true, privateMemory: false, slowFrames: "long-animation-frame" },
  processes: [],
  frames: [],
  frameRate: smoothFrameRate,
  pausedExtensionIds: [],
};

const supportProcesses = [
  process({ pid: 3, role: "gpu", cpuPercent: 11 }),
  process({ pid: 1, role: "main", cpuPercent: 1.2 }),
  process({ pid: 4, role: "utility", name: "Network Service", cpuPercent: 0.1 }),
];

export const smoothSnapshot: PerformanceSnapshot = {
  ...base,
  processes: [
    process({ pid: 11, role: "workbench", cpuPercent: 6, averageCpuPercent: 6 }),
    extension(21, "notes", 2, 1, 74_000),
    extension(22, "motion", 1, 1, 81_000),
    ...supportProcesses,
  ],
};

export const underLoadSnapshot: PerformanceSnapshot = {
  ...base,
  frameRate: loadFrameRate,
  processes: [
    process({
      pid: 11,
      role: "workbench",
      cpuPercent: 104,
      averageCpuPercent: 104,
      sustainedHighCpu: true,
      memoryKiB: { workingSet: 207_000, peakWorkingSet: 240_000, privateBytes: null },
    }),
    extension(23, "shader", 34, 1, 86_000),
    extension(22, "motion", 6, 1, 81_000),
    extension(21, "notes", 1, 1, 74_000),
    ...supportProcesses,
  ],
  frames,
};

export const manyExtensionsSnapshot: PerformanceSnapshot = {
  ...base,
  processes: [
    process({ pid: 11, role: "workbench", cpuPercent: 8, averageCpuPercent: 8 }),
    extension(23, "shader", 27),
    extension(24, "radar", 9, 2, 140_000),
    extension(25, "tickets", 4, 3, 118_000),
    extension(22, "motion", 3),
    extension(21, "notes", 2),
    extension(26, "pencil", 1),
    extension(27, "lab", 1),
    extension(28, "font", 1),
    extension(29, "reports", 0),
    extension(30, "artifacts", 0),
    extension(31, "loops", 0),
    extension(32, "glass", 0),
  ],
};

export const collectingSnapshot: PerformanceSnapshot = {
  ...base,
  measurementWindowMs: null,
  frameRate: [],
  processes: [],
};

export const browserSnapshot: PerformanceSnapshot = {
  ...base,
  host: "browser",
  sampleIntervalMs: null,
  warning: null,
  measurementWindowMs: null,
  capabilities: { processMetrics: false, idleWakeups: false, privateMemory: false, slowFrames: "long-animation-frame" },
  frames: [frames[1]!],
};

const backendProcess = (
  sequence: number,
  startId: string,
  cpu: number,
  megabytes: number,
): PerformanceProcessSample => ({
  pid: startId === "backend-2" ? 52 : 51,
  processStartId: startId,
  role: "backend",
  cpuPercent: cpu,
  cpuTimeMs: sequence * 40,
  residentBytes: megabytes * 1_300_000,
  peakResidentBytes: null,
  physicalFootprintBytes: megabytes * 1_000_000,
  peakPhysicalFootprintBytes: (megabytes + 40) * 1_000_000,
  privateCommittedBytes: null,
  heapUsedBytes: null,
  externalBytes: null,
});

const workbenchProcess = (sequence: number, cpu: number): PerformanceProcessSample => ({
  pid: 11,
  processStartId: "workbench-1",
  role: "workbench",
  cpuPercent: cpu,
  cpuTimeMs: sequence * 60,
  residentBytes: 310_000_000,
  peakResidentBytes: 340_000_000,
  physicalFootprintBytes: 280_000_000,
  peakPhysicalFootprintBytes: 300_000_000,
  privateCommittedBytes: null,
  heapUsedBytes: null,
  externalBytes: null,
});

type BackendReading = { durationMs: number | null; state?: PerformanceCaptureSample["backend"]["state"] };

const capture = (readings: BackendReading[], restartAt?: number): Extract<PerformanceSnapshot, { version: 2 }> => ({
  ...smoothSnapshot,
  version: 2,
  capture: {
    version: 2,
    id: "capture-1",
    startedAt: "2026-10-02T12:04:00.000Z",
    hostVersion: "0.46.0",
    platform: "darwin",
    sampleIntervalMs: 2_000,
    droppedSamples: 0,
    samples: readings.map((reading, index) => ({
      sequence: index + 1,
      capturedAt: new Date(Date.parse("2026-10-02T12:04:02.000Z") + index * 2_000).toISOString(),
      elapsedMs: (index + 1) * 2_000,
      intervalMs: 2_000,
      processes: [
        backendProcess(
          index,
          restartAt !== undefined && index >= restartAt ? "backend-2" : "backend-1",
          3 + (index % 4),
          420 + index * 6,
        ),
        workbenchProcess(index, 5 + (index % 3)),
      ],
      backend: {
        runtimeId: "runtime-1",
        scope: "local",
        state: reading.state ?? "reply",
        durationMs: reading.durationMs,
        observedForMs: reading.durationMs ?? 5_000,
        runtime: null,
      },
    })),
  },
});

const replies = [9, 11, 8, 14, 10, 9, 12, 40, 75, 18, 11, 9, 10, 12, 9].map((durationMs) => ({ durationMs }));

export const backendSnapshot = capture(replies);
export const reconnectingSnapshot = capture([
  ...replies.slice(0, 11),
  ...Array.from({ length: 4 }, () => ({ durationMs: null, state: "timeout" as const })),
]);
export const restartedSnapshot = capture(
  [...replies.slice(0, 8), { durationMs: null, state: "unavailable" as const }, ...replies.slice(9)],
  9,
);

// Chromium usually runs every extension view in one renderer process.
export const sharedProcessSnapshot: PerformanceSnapshot = {
  ...smoothSnapshot,
  processes: [
    process({ pid: 11, role: "workbench", cpuPercent: 6, averageCpuPercent: 6 }),
    process({
      pid: 40,
      role: "extension-frames",
      cpuPercent: 18,
      averageCpuPercent: 18,
      extensionFrames: [
        ...["scribble", "kiln", "boombox"].map((view) => ({
          installedExtensionId: "installed-lab",
          webviewId: `pstdio.extension-lab.view.${view}`,
        })),
        { installedExtensionId: "installed-notes", webviewId: "pstdio.pstdio-notes.view.editor" },
        { installedExtensionId: "installed-performance", webviewId: "pstdio.pstdio-performance.view.meter" },
      ],
      memoryKiB: { workingSet: 214_000, peakWorkingSet: 240_000, privateBytes: null },
    }),
  ],
};
