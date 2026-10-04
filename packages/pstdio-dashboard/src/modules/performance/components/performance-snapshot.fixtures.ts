import type { PerformanceProcess, PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";

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

// One process per extension, so the stories show one row each.
const extension = (pid: number, installedExtensionId: string, cpu: number, views = 1, workingSet = 80_000) =>
  process({
    pid,
    role: "extension-frames",
    cpuPercent: cpu,
    averageCpuPercent: cpu,
    extensionFrames: Array.from({ length: views }, (_, index) => ({
      installedExtensionId,
      webviewId: `view-${index}`,
    })),
    memoryKiB: { workingSet, peakWorkingSet: workingSet, privateBytes: null },
  });

export const extensionNames: Record<string, string> = {
  shader: "Shader Lab",
  motion: "Motion Lab",
  notes: "Notes",
  radar: "Social Radar",
  tickets: "Tickets",
  pencil: "Pencil",
  lab: "Extension Lab",
  font: "Font Editor",
  reports: "Reports",
  artifacts: "Artifacts",
  loops: "Loops",
  glass: "Glass Lab",
};

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
