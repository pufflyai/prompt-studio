import type { ProcessMetric } from "electron";
import {
  PERFORMANCE_LIMITS,
  type PerformanceProcess,
  type PerformanceSnapshot,
  type SlowFrame,
  type SlowFrameSource,
  slowFrameReportSchema,
} from "pstdio-api-contracts/performance-diagnostics";
import { attributeProcess, type OwnedFrame } from "./process-attribution";

// Measured cost: one getAppMetrics call and one frame walk per sample. A 30-second
// window at 80% of one core catches sustained work, such as streaming at ~100%,
// while a single busy sample cannot raise the warning on its own.
const SAMPLE_INTERVAL_MS = 2_000;
const WARNING = { windowMs: 30_000, cpuPercent: 80 };
const WINDOW_SAMPLES = WARNING.windowMs / SAMPLE_INTERVAL_MS;

const round = (value: number) => Math.round(value * 10) / 10;

export interface PerformanceMonitorOptions {
  preference: { readonly enabled: boolean; set: (enabled: boolean) => void };
  readMetrics: () => ProcessMetric[];
  listFrames: () => OwnedFrame[];
  runtimeOrigin: () => string | null;
  platform: NodeJS.Platform;
  // Logical CPUs. Electron divides each process's CPU by this count.
  cpuCount: number;
  openEndpoint: (read: () => PerformanceSnapshot | null) => Promise<{ close: () => Promise<void> }>;
  now?: () => number;
  schedule?: (callback: () => void, intervalMs: number) => () => void;
}

const scheduleInterval = (callback: () => void, intervalMs: number) => {
  const timer = setInterval(callback, intervalMs);
  return () => clearInterval(timer);
};

// The one collector for this device. It runs only while the person has monitoring
// on, and keeps a bounded amount of data whether or not a view is reading it.
export class DesktopPerformanceMonitor {
  readonly #options: PerformanceMonitorOptions;
  #cancel: (() => void) | null = null;
  #endpoint: { close: () => Promise<void> } | null = null;
  #cpuHistory = new Map<string, number[]>();
  #lastSampleAt: number | null = null;
  #latest: { capturedAt: number; windowMs: number; processes: PerformanceProcess[] } | null = null;
  #frames: SlowFrame[] = [];
  #frameSource: SlowFrameSource | null = null;
  // Changes run one at a time, so an endpoint never opens while the last one closes.
  #changes: Promise<void> = Promise.resolve();

  constructor(options: PerformanceMonitorOptions) {
    this.#options = options;
  }

  get enabled() {
    return this.#options.preference.enabled;
  }

  start() {
    return this.#change(async () => {
      if (this.enabled) await this.#begin();
    });
  }

  setEnabled(enabled: boolean) {
    return this.#change(async () => {
      if (enabled === Boolean(this.#cancel)) return;
      this.#options.preference.set(enabled);
      if (enabled) await this.#begin();
      else await this.#end();
    });
  }

  // Stops collection without changing the saved switch, for example on quit.
  stop() {
    return this.#change(() => this.#end());
  }

  #change(apply: () => Promise<void>) {
    const change = this.#changes.then(apply);
    this.#changes = change.catch(() => {});
    return change;
  }

  async #end() {
    this.#cancel?.();
    this.#cancel = null;
    this.#cpuHistory.clear();
    this.#lastSampleAt = null;
    this.#latest = null;
    this.#frames = [];
    this.#frameSource = null;
    const endpoint = this.#endpoint;
    this.#endpoint = null;
    await endpoint?.close();
  }

  reportFrames(report: unknown) {
    const { source, frames } = slowFrameReportSchema.parse(report);
    if (!this.#cancel) return;
    this.#frameSource = source;
    this.#frames = [...frames.reverse(), ...this.#frames].slice(0, PERFORMANCE_LIMITS.frames);
  }

  snapshot(): PerformanceSnapshot | null {
    if (!this.#cancel) return null;
    const { platform } = this.#options;
    return {
      version: 1,
      host: "desktop",
      capturedAt: new Date(this.#latest?.capturedAt ?? this.#now()).toISOString(),
      sampleIntervalMs: SAMPLE_INTERVAL_MS,
      measurementWindowMs: this.#latest?.windowMs ?? null,
      warning: WARNING,
      capabilities: {
        processMetrics: true,
        idleWakeups: platform !== "win32",
        privateMemory: platform === "win32",
        slowFrames: this.#frameSource,
      },
      processes: this.#latest?.processes ?? [],
      frames: this.#frames,
    };
  }

  #now() {
    return this.#options.now?.() ?? Date.now();
  }

  async #begin() {
    // The first metrics call only starts Electron's CPU measurement window.
    this.#options.readMetrics();
    this.#lastSampleAt = this.#now();
    this.#cancel = (this.#options.schedule ?? scheduleInterval)(() => {
      try {
        this.#sample();
      } catch {
        // A frame can be disposed while a renderer reloads or exits. Skip this sample;
        // the next one reads the new frames.
      }
    }, SAMPLE_INTERVAL_MS);
    this.#endpoint = await this.#options.openEndpoint(() => this.snapshot());
  }

  #sample() {
    const { platform, cpuCount } = this.#options;
    const capturedAt = this.#now();
    const frames = this.#options.listFrames();
    const runtimeOrigin = this.#options.runtimeOrigin();
    const live = new Set<string>();
    const processes = this.#options.readMetrics().map((metric) => {
      const key = `${metric.pid}:${metric.creationTime}`;
      live.add(key);
      // People compare this with activity monitors, where one busy core is 100%.
      const cpuPercent = metric.cpu.percentCPUUsage * cpuCount;
      const history = [...(this.#cpuHistory.get(key) ?? []), cpuPercent].slice(-WINDOW_SAMPLES);
      this.#cpuHistory.set(key, history);
      const average =
        history.length === WINDOW_SAMPLES ? history.reduce((sum, value) => sum + value, 0) / WINDOW_SAMPLES : null;
      return {
        pid: metric.pid,
        ...attributeProcess(metric, frames, runtimeOrigin),
        cpuPercent: round(cpuPercent),
        averageCpuPercent: average === null ? null : round(average),
        sustainedHighCpu: average !== null && average >= WARNING.cpuPercent,
        // Electron always reports zero idle wakeups on Windows.
        idleWakeupsPerSecond: platform === "win32" ? null : round(metric.cpu.idleWakeupsPerSecond),
        memoryKiB: {
          workingSet: metric.memory.workingSetSize,
          peakWorkingSet: metric.memory.peakWorkingSetSize,
          privateBytes: metric.memory.privateBytes ?? null,
        },
      } satisfies PerformanceProcess;
    });
    for (const key of this.#cpuHistory.keys()) if (!live.has(key)) this.#cpuHistory.delete(key);
    processes.sort((left, right) => right.cpuPercent - left.cpuPercent);
    this.#latest = { capturedAt, windowMs: capturedAt - (this.#lastSampleAt ?? capturedAt), processes };
    this.#lastSampleAt = capturedAt;
  }
}
