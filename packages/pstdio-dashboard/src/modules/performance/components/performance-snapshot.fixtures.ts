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

export const desktopSnapshot: PerformanceSnapshot = {
  version: 1,
  host: "desktop",
  capturedAt: "2026-10-02T12:04:32.000Z",
  sampleIntervalMs: 2_000,
  warning: { windowMs: 30_000, cpuPercent: 80 },
  measurementWindowMs: 2_000,
  capabilities: { processMetrics: true, idleWakeups: true, privateMemory: false, slowFrames: "long-animation-frame" },
  processes: [
    process({
      pid: 11,
      role: "workbench",
      cpuPercent: 104,
      averageCpuPercent: 104,
      sustainedHighCpu: true,
      memoryKiB: { workingSet: 207_000, peakWorkingSet: 240_000, privateBytes: null },
    }),
    process({
      pid: 12,
      role: "extension-frames",
      cpuPercent: 28,
      averageCpuPercent: 26.4,
      extensionFrames: [
        { installedExtensionId: "installed-lab", webviewId: "lab" },
        { installedExtensionId: "installed-shader", webviewId: "shader" },
      ],
      memoryKiB: { workingSet: 94_000, peakWorkingSet: 98_000, privateBytes: null },
    }),
    process({
      pid: 3,
      role: "gpu",
      cpuPercent: 11,
      memoryKiB: { workingSet: 78_000, peakWorkingSet: 80_000, privateBytes: null },
    }),
    process({
      pid: 1,
      role: "main",
      cpuPercent: 1.2,
      memoryKiB: { workingSet: 150_000, peakWorkingSet: 160_000, privateBytes: null },
    }),
    process({ pid: 4, role: "utility", name: "Network Service", cpuPercent: 0.1 }),
    process({ pid: 10, role: "startup", cpuPercent: 0 }),
  ],
  frames,
};

export const browserSnapshot: PerformanceSnapshot = {
  ...desktopSnapshot,
  host: "browser",
  sampleIntervalMs: null,
  warning: null,
  measurementWindowMs: null,
  capabilities: { processMetrics: false, idleWakeups: false, privateMemory: false, slowFrames: "long-animation-frame" },
  processes: [],
  frames: frames.slice(0, 1),
};

export const extensionNames: Record<string, string> = {
  "installed-lab": "Lab",
  "installed-shader": "Shader Lab",
};
