import { expect, test } from "bun:test";
import type { PerformanceCapture } from "pstdio-api-contracts/performance-diagnostics";
import { restoreRecordedCapture } from "./recorded-capture";

const sample = (sequence: number) => ({
  sequence,
  capturedAt: new Date(sequence * 2000).toISOString(),
  elapsedMs: sequence * 2000,
  intervalMs: sequence === 0 ? null : 2000,
  processes: [],
  backend: {
    runtimeId: null,
    scope: "unavailable" as const,
    state: "unavailable" as const,
    durationMs: null,
    observedForMs: 0,
    runtime: null,
  },
});
const live: PerformanceCapture = {
  version: 2,
  id: "current",
  startedAt: new Date(0).toISOString(),
  hostVersion: "test",
  platform: "linux",
  sampleIntervalMs: 2000,
  samples: [sample(2)],
  droppedSamples: 2,
};

test("restores startup samples outside the live window and ignores earlier capture lifetimes", () => {
  const saved = {
    directory: "saved",
    files: [
      {
        name: "performance-0.jsonl",
        content: [1, 2]
          .map((sequence) =>
            JSON.stringify({
              kind: "sample",
              captureId: "current",
              sample: sample(sequence),
            }),
          )
          .join("\n"),
      },
      {
        name: "performance-1.jsonl",
        content: [
          { kind: "sample", captureId: "older", sample: sample(99) },
          { kind: "start", capture: { ...live, samples: [], droppedSamples: 0 } },
          { kind: "sample", captureId: "current", sample: sample(0) },
        ]
          .map((record) => JSON.stringify(record))
          .join("\n"),
      },
    ],
  };
  const restored = restoreRecordedCapture(saved, live);
  expect(restored.samples.map((entry) => entry.sequence)).toEqual([0, 1, 2]);
  expect(restored.droppedSamples).toBe(0);
  expect(restored.id).toBe("current");
});

test("preserves lost-startup coverage when rotation has removed its records", () => {
  expect(restoreRecordedCapture({ directory: "saved", files: [] }, live).droppedSamples).toBe(2);
});
