import { describe, expect, test } from "bun:test";
import type { ProcessMetric } from "electron";
import { DesktopPerformanceMonitor, type PerformanceMonitorOptions } from "./performance-monitor";

const metric = (pid: number, type: ProcessMetric["type"], cpu: number) =>
  ({
    pid,
    type,
    creationTime: pid * 1000,
    cpu: { percentCPUUsage: cpu, idleWakeupsPerSecond: 3 },
    memory: { workingSetSize: 2048, peakWorkingSetSize: 4096 },
  }) as ProcessMetric;

const frame = {
  startedAt: "2026-10-02T12:04:31.000Z",
  durationMs: 182,
  blockingDurationMs: 132,
  scripts: [],
};

const createHarness = (enabled = false, cpuCount = 1) => {
  let preference = enabled;
  let framesFail = false;
  let workbenchCpu = 0;
  let now = 0;
  let tick: (() => void) | null = null;
  const endpoint = { opened: 0, closed: 0 };
  const events: string[] = [];
  const options: PerformanceMonitorOptions = {
    preference: {
      get enabled() {
        return preference;
      },
      set: (value) => {
        preference = value;
      },
    },
    readMetrics: () => [metric(1, "Browser", 1), metric(11, "Tab", workbenchCpu)],
    listFrames: () => {
      if (framesFail) throw new Error("Render frame was disposed before WebFrameMain could be accessed");
      return [{ owner: "workbench", isMainFrame: true, osProcessId: 11, url: "http://127.0.0.1:1/" }];
    },
    runtimeOrigin: () => "http://127.0.0.1:1",
    platform: "darwin",
    cpuCount,
    now: () => now,
    schedule: (callback) => {
      tick = callback;
      return () => {
        tick = null;
      };
    },
    openEndpoint: async () => {
      endpoint.opened += 1;
      events.push("open");
      return {
        close: async () => {
          endpoint.closed += 1;
          events.push("close");
          await new Promise((resolve) => setTimeout(resolve, 5));
          events.push("closed");
        },
      };
    },
  };
  const sample = (cpu: number) => {
    workbenchCpu = cpu;
    now += 2_000;
    tick?.();
  };
  return {
    endpoint,
    events,
    monitor: new DesktopPerformanceMonitor(options),
    sample,
    preference: () => preference,
    scheduled: () => tick !== null,
    failFrames: (fail: boolean) => {
      framesFail = fail;
    },
  };
};

describe("desktop performance monitor", () => {
  test("collects nothing and serves nothing while off, including after a restart", async () => {
    const harness = createHarness(false);
    await harness.monitor.start();

    expect(harness.scheduled()).toBe(false);
    expect(harness.endpoint.opened).toBe(0);
    expect(harness.monitor.snapshot()).toBeNull();
    harness.monitor.reportFrames({ source: "long-animation-frame", frames: [frame] });
    expect(harness.monitor.snapshot()).toBeNull();
  });

  test("resumes collection on start when this device left it on", async () => {
    const harness = createHarness(true);
    await harness.monitor.start();

    expect(harness.scheduled()).toBe(true);
    expect(harness.endpoint.opened).toBe(1);
  });

  test("reports CPU per process for the measured window, busiest first", async () => {
    const harness = createHarness();
    await harness.monitor.setEnabled(true);
    harness.sample(42.25);

    const snapshot = harness.monitor.snapshot();
    expect(snapshot).toMatchObject({
      version: 1,
      host: "desktop",
      capturedAt: new Date(2_000).toISOString(),
      measurementWindowMs: 2_000,
      capabilities: { processMetrics: true, idleWakeups: true, privateMemory: false, slowFrames: null },
    });
    expect(snapshot?.processes.map((process) => [process.role, process.cpuPercent])).toEqual([
      ["workbench", 42.3],
      ["main", 1],
    ]);
    expect(snapshot?.processes[0]?.memoryKiB).toEqual({ workingSet: 2048, peakWorkingSet: 4096, privateBytes: null });
  });

  test("reports CPU as a share of one core, although Electron divides it by the core count", async () => {
    const harness = createHarness(false, 10);
    await harness.monitor.setEnabled(true);
    harness.sample(9.68);

    const workbench = harness.monitor.snapshot()?.processes.find((process) => process.role === "workbench");
    expect(workbench?.cpuPercent).toBe(96.8);
  });

  test("warns only after the whole rolling window stays busy", async () => {
    const harness = createHarness();
    await harness.monitor.setEnabled(true);
    const workbench = () => harness.monitor.snapshot()?.processes.find((process) => process.role === "workbench");

    harness.sample(400);
    for (let index = 0; index < 13; index += 1) harness.sample(0);
    expect(workbench()?.averageCpuPercent).toBeNull();
    harness.sample(0);
    expect(workbench()).toMatchObject({ averageCpuPercent: 26.7, sustainedHighCpu: false });

    for (let index = 0; index < 15; index += 1) harness.sample(95);
    expect(workbench()).toMatchObject({ averageCpuPercent: 95, sustainedHighCpu: true });
    harness.sample(0);
    harness.sample(0);
    harness.sample(0);
    expect(workbench()?.sustainedHighCpu).toBe(false);
  });

  test("keeps the newest validated slow frames within the snapshot limit", async () => {
    const harness = createHarness();
    await harness.monitor.setEnabled(true);
    for (let index = 0; index < 4; index += 1) {
      harness.monitor.reportFrames({
        source: "long-animation-frame",
        frames: Array.from({ length: 20 }, (_, offset) => ({ ...frame, durationMs: index * 20 + offset })),
      });
    }

    const frames = harness.monitor.snapshot()?.frames ?? [];
    expect(frames).toHaveLength(50);
    expect(frames[0]?.durationMs).toBe(79);
    expect(harness.monitor.snapshot()?.capabilities.slowFrames).toBe("long-animation-frame");
    expect(() =>
      harness.monitor.reportFrames({ source: "long-animation-frame", frames: [{ ...frame, url: "x" }] }),
    ).toThrow();
  });

  test("shares the workbench frame rate and paused extensions that the renderer reports", async () => {
    const harness = createHarness();
    harness.monitor.reportRendererState({ frameRate: [60], pausedExtensionIds: ["shader"] });
    expect(harness.monitor.snapshot()).toBeNull();

    await harness.monitor.setEnabled(true);
    expect(harness.monitor.snapshot()).toMatchObject({ frameRate: [], pausedExtensionIds: [] });
    harness.monitor.reportRendererState({ frameRate: [60, 58, 34], pausedExtensionIds: ["shader"] });

    expect(harness.monitor.snapshot()).toMatchObject({ frameRate: [60, 58, 34], pausedExtensionIds: ["shader"] });
    expect(() =>
      harness.monitor.reportRendererState({ frameRate: Array(31).fill(60), pausedExtensionIds: [] }),
    ).toThrow();
  });

  test("turning off stops sampling, closes the endpoint, and clears every sample", async () => {
    const harness = createHarness();
    await harness.monitor.setEnabled(true);
    harness.sample(50);
    harness.monitor.reportFrames({ source: "longtask", frames: [frame] });
    harness.monitor.reportRendererState({ frameRate: [60], pausedExtensionIds: ["shader"] });

    await harness.monitor.setEnabled(false);
    expect(harness.preference()).toBe(false);
    expect(harness.scheduled()).toBe(false);
    expect(harness.endpoint.closed).toBe(1);
    expect(harness.monitor.snapshot()).toBeNull();

    await harness.monitor.setEnabled(true);
    expect(harness.monitor.snapshot()).toMatchObject({
      processes: [],
      frames: [],
      frameRate: [],
      pausedExtensionIds: [],
      measurementWindowMs: null,
    });
  });

  test("closes an endpoint that finishes opening after monitoring was turned off", async () => {
    const harness = createHarness();
    const enabling = harness.monitor.setEnabled(true);
    await harness.monitor.setEnabled(false);
    await enabling;

    expect(harness.endpoint).toEqual({ opened: 1, closed: 1 });
    expect(harness.scheduled()).toBe(false);
  });

  test("applies quick off-and-on changes in order and ends with the last one", async () => {
    const harness = createHarness();
    await harness.monitor.setEnabled(true);
    await Promise.all([harness.monitor.setEnabled(false), harness.monitor.setEnabled(true)]);

    expect(harness.preference()).toBe(true);
    expect(harness.scheduled()).toBe(true);
    expect(harness.events).toEqual(["open", "close", "closed", "open"]);
  });

  test("skips a sample when a frame is disposed mid-sample and keeps sampling", async () => {
    const harness = createHarness();
    await harness.monitor.setEnabled(true);
    harness.failFrames(true);
    expect(() => harness.sample(10)).not.toThrow();
    harness.failFrames(false);
    harness.sample(20);

    expect(harness.monitor.snapshot()?.processes.find((process) => process.role === "workbench")?.cpuPercent).toBe(20);
  });
});
