import { describe, expect, test } from "bun:test";
import type { PerformanceCaptureSample, PerformanceProcessSample, PerformanceSnapshot } from "@pstdio/sdk/extensions";
import { performanceHistory } from "./performance-history";

const process = (overrides: Partial<PerformanceProcessSample>): PerformanceProcessSample => ({
  pid: 10,
  processStartId: "backend-1",
  role: "backend",
  cpuPercent: 4,
  cpuTimeMs: 100,
  residentBytes: 300_000_000,
  peakResidentBytes: null,
  physicalFootprintBytes: null,
  peakPhysicalFootprintBytes: null,
  privateCommittedBytes: null,
  heapUsedBytes: null,
  externalBytes: null,
  ...overrides,
});

const sample = (
  sequence: number,
  backend: Partial<PerformanceCaptureSample["backend"]>,
  processes: PerformanceProcessSample[] = [process({})],
): PerformanceCaptureSample => ({
  sequence,
  capturedAt: new Date(sequence * 2000).toISOString(),
  elapsedMs: sequence * 2000,
  intervalMs: 2000,
  processes,
  backend: {
    runtimeId: "runtime",
    scope: "local",
    state: "reply",
    durationMs: 12,
    observedForMs: 12,
    runtime: null,
    ...backend,
  },
});

const snapshot = (samples: PerformanceCaptureSample[]): PerformanceSnapshot => ({
  version: 2,
  host: "desktop",
  capturedAt: new Date().toISOString(),
  sampleIntervalMs: 2000,
  warning: null,
  measurementWindowMs: 2000,
  capabilities: { processMetrics: true, idleWakeups: false, privateMemory: false, slowFrames: null },
  processes: [],
  frames: [],
  frameRate: [],
  pausedExtensionIds: [],
  capture: {
    version: 2,
    id: "capture",
    startedAt: new Date(0).toISOString(),
    hostVersion: "0.46.0",
    platform: "darwin",
    sampleIntervalMs: 2000,
    samples,
    droppedSamples: 0,
  },
});

describe("performance history", () => {
  test("keeps timeouts out of response times and reports the lost connection", () => {
    const history = performanceHistory(
      snapshot([
        sample(1, { durationMs: 10 }),
        sample(2, { durationMs: 30 }),
        sample(3, { state: "timeout", durationMs: null, observedForMs: 5000 }),
      ]),
    );

    expect(history.response.map((point) => point.durationMs)).toEqual([10, 30, null]);
    expect(history.response.map((point) => point.missed)).toEqual([false, false, true]);
    expect(history.responseSummary).toEqual({ averageMs: 20, maxMs: 30, missed: 1 });
    expect(history.connection).toBe("reconnecting");
  });

  test("keeps reporting a lost connection for an outage longer than the chart", () => {
    const failures = Array.from({ length: 20 }, (_, index) =>
      sample(index + 2, { state: "unavailable", scope: "local", durationMs: null }),
    );
    const history = performanceHistory(snapshot([sample(1, {}), ...failures]));

    expect(history.connection).toBe("reconnecting");
    // A refused connection from a known backend is a missed reply, never a response time.
    expect(history.response.every((point) => point.missed && point.durationMs === null)).toBe(true);
    expect(history.responseSummary.missed).toBe(15);
  });

  test("shows recovery once the backend replies again", () => {
    const history = performanceHistory(
      snapshot([sample(1, {}), sample(2, { state: "unavailable", scope: "local", durationMs: null }), sample(3, {})]),
    );

    expect(history.connection).toBe("connected");
  });

  test("never treats an unmeasured backend as connected or zero", () => {
    const history = performanceHistory(
      snapshot([sample(1, { state: "unavailable", scope: "unavailable", durationMs: null })]),
    );

    expect(history.connection).toBe("unavailable");
    expect(history.response[0]?.durationMs).toBeNull();
  });

  test("separates backend and workbench readings and prefers the physical footprint", () => {
    const workbench = process({
      pid: 20,
      processStartId: "workbench-1",
      role: "workbench",
      cpuPercent: 9,
      residentBytes: 200,
    });
    const backend = process({ physicalFootprintBytes: 500, residentBytes: 900 });
    const history = performanceHistory(snapshot([sample(1, {}, [backend, workbench])]));

    expect(history.backend.at(-1)).toMatchObject({ cpuPercent: 4, memoryBytes: 500, memoryKind: "footprint" });
    expect(history.workbench.at(-1)).toMatchObject({ cpuPercent: 9, memoryBytes: 200, memoryKind: "resident" });
  });

  test("marks a backend restart and keeps missing readings unavailable", () => {
    const history = performanceHistory(
      snapshot([sample(1, {}), sample(2, {}, []), sample(3, {}, [process({ pid: 11, processStartId: "backend-2" })])]),
    );

    expect(history.backend.map((point) => point.cpuPercent)).toEqual([4, null, 4]);
    expect(history.backend.map((point) => point.restarted)).toEqual([false, false, true]);
  });

  test("has no history before a version 2 capture exists", () => {
    const { capture: _capture, ...rest } = snapshot([]) as Extract<PerformanceSnapshot, { version: 2 }>;
    const history = performanceHistory({ ...rest, version: 1 });

    expect(history.response).toEqual([]);
    expect(history.connection).toBe("unavailable");
  });
});
