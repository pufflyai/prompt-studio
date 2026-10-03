import { describe, expect, test } from "bun:test";
import { BROWSER_PERFORMANCE_MONITORING_KEY, createPerformanceHost } from "./performance-host";
import { createPerformanceMonitoringController } from "./performance-monitoring-controller";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};

const frame = (durationMs: number) => ({
  startedAt: "2026-10-02T12:04:31.000Z",
  durationMs,
  blockingDurationMs: null,
  scripts: [],
});

describe("browser performance monitoring", () => {
  test("is off by default and measures nothing", async () => {
    const controller = createPerformanceMonitoringController(createPerformanceHost(undefined, createStorage()));
    await controller.load();

    expect(controller.getEnabled()).toBe(false);
    controller.host.reportFrames({ source: "longtask", frames: [frame(80)] });
    expect(await controller.host.snapshot()).toBeNull();
  });

  test("saves the switch for this browser and reports renderer measurements only", async () => {
    const storage = createStorage();
    const controller = createPerformanceMonitoringController(createPerformanceHost(undefined, storage));
    await controller.setEnabled(true);

    const restarted = createPerformanceMonitoringController(createPerformanceHost(undefined, storage));
    await restarted.load();
    expect(restarted.getEnabled()).toBe(true);

    const snapshot = await controller.host.snapshot();
    expect(snapshot).toMatchObject({
      host: "browser",
      sampleIntervalMs: null,
      warning: null,
      capabilities: { processMetrics: false, idleWakeups: false, privateMemory: false },
      processes: [],
    });
    // The observer announces what this renderer can measure as soon as it starts.
    expect(snapshot?.capabilities.slowFrames).not.toBeNull();
    controller.dispose();
    restarted.dispose();
  });

  test("keeps the newest frames within the limit and clears them when turned off", async () => {
    const storage = createStorage();
    const controller = createPerformanceMonitoringController(createPerformanceHost(undefined, storage));
    await controller.setEnabled(true);
    for (let index = 0; index < 3; index += 1) {
      controller.host.reportFrames({
        source: "longtask",
        frames: Array.from({ length: 20 }, (_, offset) => frame(index * 20 + offset)),
      });
    }
    const frames = (await controller.host.snapshot())?.frames ?? [];
    expect(frames).toHaveLength(50);
    expect(frames[0]?.durationMs).toBe(59);

    await controller.setEnabled(false);
    expect(storage.values.has(BROWSER_PERFORMANCE_MONITORING_KEY)).toBe(false);
    await controller.setEnabled(true);
    expect((await controller.host.snapshot())?.frames).toEqual([]);
    controller.dispose();
  });
});
