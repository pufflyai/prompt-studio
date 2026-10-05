import { describe, expect, test } from "bun:test";
import { pausedExtensions } from "@/shared/extensions/paused-extensions";
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
  test("does not restart reporting when the saved switch loads after disposal", async () => {
    let complete!: (enabled: boolean) => void;
    let reports = 0;
    const pending = new Promise<boolean>((resolve) => {
      complete = resolve;
    });
    const controller = createPerformanceMonitoringController({
      kind: "desktop",
      isEnabled: () => pending,
      setEnabled: async () => {},
      snapshot: async () => null,
      reportFrames: () => {
        reports += 1;
      },
      reportState: () => {},
    });
    const loading = controller.load();
    controller.dispose();
    complete(true);
    await loading;
    controller.dispose();
    expect(reports).toBe(0);
  });

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

  test("shares paused extensions in the snapshot while monitoring is on", async () => {
    const controller = createPerformanceMonitoringController(createPerformanceHost(undefined, createStorage()));
    pausedExtensions.pause("shader");
    await controller.setEnabled(true);
    expect((await controller.host.snapshot())?.pausedExtensionIds).toEqual(["shader"]);

    pausedExtensions.resume("shader");
    expect((await controller.host.snapshot())?.pausedExtensionIds).toEqual([]);
    controller.dispose();
  });

  test("keeps measuring when the host cannot turn monitoring off", async () => {
    let hostEnabled = true;
    const controller = createPerformanceMonitoringController({
      kind: "desktop",
      isEnabled: async () => hostEnabled,
      setEnabled: async (next) => {
        if (!next) throw new Error("IPC failed");
        hostEnabled = next;
      },
      snapshot: async () => null,
      reportFrames: () => {},
      reportState: () => {},
    });
    await controller.load();

    await expect(controller.setEnabled(false)).rejects.toThrow("IPC failed");
    expect(controller.getEnabled()).toBe(true);
    controller.dispose();
  });
});
