import { z } from "zod";

// Local performance diagnostics are shared by the desktop host, the dashboard, and
// the `pst performance` command. Nothing here is sent to the runtime or a server.

// Limits keep reports and snapshots small even when no view reads them for hours.
export const PERFORMANCE_LIMITS = {
  frames: 50,
  framesPerReport: 20,
  scriptsPerFrame: 5,
  text: 120,
  frameRateSeconds: 30,
  pausedExtensions: 100,
} as const;

const boundedText = z.string().max(PERFORMANCE_LIMITS.text);
const durationMs = z.number().finite().nonnegative();

const slowFrameSourceSchema = z.enum(["long-animation-frame", "longtask", "unsupported"]);

const slowFrameScriptSchema = z.strictObject({
  invokerType: boundedText,
  invoker: boundedText,
  source: boundedText.nullable(),
  functionName: boundedText.nullable(),
  durationMs,
});

const slowFrameSchema = z.strictObject({
  startedAt: z.iso.datetime(),
  durationMs,
  blockingDurationMs: durationMs.nullable(),
  scripts: z.array(slowFrameScriptSchema).max(PERFORMANCE_LIMITS.scriptsPerFrame),
});

// What a renderer sends to its host. The renderer sanitizes script attribution;
// the host validates the shape and limits again before keeping anything.
export const slowFrameReportSchema = z.strictObject({
  source: slowFrameSourceSchema,
  frames: z.array(slowFrameSchema).max(PERFORMANCE_LIMITS.framesPerReport),
});

// The workbench window's own state: frames drawn in each of the last 30 seconds,
// oldest first, and the extensions paused from the performance monitor.
export const rendererStateReportSchema = z.strictObject({
  frameRate: z.array(z.number().int().nonnegative().max(1_000)).max(PERFORMANCE_LIMITS.frameRateSeconds),
  pausedExtensionIds: z.array(boundedText).max(PERFORMANCE_LIMITS.pausedExtensions),
});

export type RendererStateReport = z.infer<typeof rendererStateReportSchema>;
export type SlowFrameSource = z.infer<typeof slowFrameSourceSchema>;
export type SlowFrame = z.infer<typeof slowFrameSchema>;
export type SlowFrameReport = z.infer<typeof slowFrameReportSchema>;

export type PerformanceProcessRole =
  | "main"
  | "gpu"
  | "utility"
  | "workbench"
  | "startup"
  | "extension-frames"
  | "renderer"
  | "other";

export interface PerformanceExtensionFrame {
  installedExtensionId: string;
  webviewId: string;
}

export interface PerformanceProcess {
  pid: number;
  role: PerformanceProcessRole;
  // Chromium's service name for utility processes, such as "Network Service".
  name: string | null;
  // Extension webviews hosted by this process. One process can host several, so
  // its CPU and memory belong to all of them together.
  extensionFrames: PerformanceExtensionFrame[];
  // Share of one CPU core during the measurement window. Values can exceed 100.
  cpuPercent: number;
  // Average over the warning window. Null until the window has enough samples.
  averageCpuPercent: number | null;
  sustainedHighCpu: boolean;
  idleWakeupsPerSecond: number | null;
  memoryKiB: {
    workingSet: number;
    peakWorkingSet: number;
    privateBytes: number | null;
  };
}

export interface PerformanceSnapshot {
  version: 1;
  host: "desktop" | "browser";
  capturedAt: string;
  // Process sampling settings. Null where process metrics are unavailable.
  sampleIntervalMs: number | null;
  warning: { windowMs: number; cpuPercent: number } | null;
  // Time covered by the CPU values. Null before the first full sample.
  measurementWindowMs: number | null;
  capabilities: {
    processMetrics: boolean;
    idleWakeups: boolean;
    privateMemory: boolean;
    // Null until the renderer reports which slow-frame entries it supports.
    slowFrames: SlowFrameSource | null;
  };
  processes: PerformanceProcess[];
  frames: SlowFrame[];
  // Frames the workbench window drew in each of the last 30 seconds, oldest first.
  frameRate: number[];
  // Extensions whose views are unloaded until the person resumes them.
  pausedExtensionIds: string[];
}
