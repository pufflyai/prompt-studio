import { expect, test } from "bun:test";
import type { PerformanceCapture, PerformanceProcessSample } from "pstdio-api-contracts/performance-diagnostics";
import { summarizePerformanceEvidence } from "./performance-evidence";

const processReading = (input: Partial<PerformanceProcessSample> = {}): PerformanceProcessSample => ({
  pid: 1,
  processStartId: "first",
  role: "backend",
  cpuPercent: 100,
  cpuTimeMs: 0,
  residentBytes: 100,
  peakResidentBytes: null,
  physicalFootprintBytes: null,
  peakPhysicalFootprintBytes: null,
  privateCommittedBytes: null,
  heapUsedBytes: null,
  externalBytes: null,
  ...input,
});

const capture = (): PerformanceCapture => ({
  version: 2,
  id: "capture",
  startedAt: "2026-10-26T00:00:00.000Z",
  hostVersion: "test",
  platform: "darwin",
  sampleIntervalMs: 2000,
  droppedSamples: 0,
  samples: Array.from({ length: 4 }, (_, index) => ({
    sequence: index,
    capturedAt: new Date(Date.UTC(2026, 9, 26, 0, 0, index * 2)).toISOString(),
    elapsedMs: index * 2000,
    intervalMs: index === 0 ? null : 2000,
    processes: [processReading({ cpuTimeMs: index * 2000, residentBytes: [100, 500, 200, 150][index] })],
    backend: {
      runtimeId: "runtime",
      scope: "local",
      state: "reply",
      durationMs: (index + 1) * 10,
      observedForMs: (index + 1) * 10,
      runtime: null,
    },
  })),
});

test("reports response distribution, CPU time and observed peak and settled memory", () => {
  const summary = summarizePerformanceEvidence(capture());
  expect(summary.failures).toEqual([]);
  expect(summary.response).toMatchObject({ replies: 4, missedReplies: 0, p50Ms: 20, p95Ms: 40, maximumMs: 40 });
  expect(summary.processes[0]).toMatchObject({
    pid: 1,
    processStartId: "first",
    cpuTimeMs: 6000,
    peakResidentBytes: 500,
    settledResidentBytes: 150,
    peakPhysicalFootprintBytes: null,
    settledHeapUsedBytes: null,
  });
});

test("keeps timed-out replies out of percentiles and counts unavailable replies", () => {
  const input = capture();
  input.samples[1]!.backend = { ...input.samples[1]!.backend, state: "timeout", durationMs: null, observedForMs: 2000 };
  input.samples[2]!.backend = { ...input.samples[2]!.backend, state: "unavailable", durationMs: null };
  expect(summarizePerformanceEvidence(input).response).toMatchObject({
    replies: 2,
    missedReplies: 2,
    timeouts: 1,
    unavailable: 1,
    p50Ms: 10,
    p95Ms: 40,
    maximumMs: 40,
  });
});

test("keeps restarted processes separate even when the operating system reuses a PID", () => {
  const input = capture();
  input.samples[2]!.processes = [processReading({ processStartId: "replacement", cpuTimeMs: 10 })];
  input.samples[3]!.processes = [processReading({ processStartId: "replacement", cpuTimeMs: 1010 })];
  const summary = summarizePerformanceEvidence(input);
  expect(summary.processes.map(({ processStartId, cpuTimeMs }) => ({ processStartId, cpuTimeMs }))).toEqual([
    { processStartId: "first", cpuTimeMs: 2000 },
    { processStartId: "replacement", cpuTimeMs: 1000 },
  ]);
});

test("fails missing measurements and reports lost history rather than healthy zeroes", () => {
  const input = capture();
  input.samples = [];
  const empty = summarizePerformanceEvidence(input);
  expect(empty.failures.length).toBeGreaterThan(0);
  expect(empty.response.maximumMs).toBeNull();
  input.samples = capture().samples.slice(1);
  input.droppedSamples = 1;
  expect(summarizePerformanceEvidence(input).failures).toContain("Capture history was truncated");
});

test("fails sampling gaps and missing required process readings", () => {
  const input = capture();
  input.samples.splice(1, 1);
  input.samples[1]!.intervalMs = 4000;
  expect(summarizePerformanceEvidence(input).failures).toContain("Capture contains a sampling gap");
  expect(summarizePerformanceEvidence(capture(), ["backend", "workbench"]).failures).toContain(
    "workbench was not measured",
  );
});

test("does not turn unsupported CPU accounting into zero CPU time", () => {
  const input = capture();
  for (const sample of input.samples) sample.processes[0]!.cpuTimeMs = null;
  const summary = summarizePerformanceEvidence(input);
  expect(summary.processes[0]!.cpuTimeMs).toBeNull();
  expect(summary.failures).toContain("backend CPU time was not measured");
});

test("fails missing native readings during a stall even when CPU counters bracket the gap", () => {
  const input = capture();
  input.samples[1]!.processes = [];
  expect(summarizePerformanceEvidence(input).failures).toContain("backend process readings are missing");
});

test("fails invalid resident readings instead of allowing a partial memory peak to pass", () => {
  const input = capture();
  input.samples[1]!.processes[0]!.residentBytes = Number.NaN;
  expect(summarizePerformanceEvidence(input).failures).toContain("backend resident memory was not measured");
});

test("fails missing startup readings once the local backend is answering", () => {
  const input = capture();
  input.samples[0]!.processes = [];
  input.samples[1]!.processes = [];
  expect(summarizePerformanceEvidence(input).failures).toContain("backend process readings are missing");
});

test("allows startup samples before a backend exists without inventing measurements", () => {
  const input = capture();
  for (const sample of input.samples.slice(0, 2)) {
    sample.processes = [];
    sample.backend = {
      ...sample.backend,
      runtimeId: null,
      scope: "unavailable",
      state: "unavailable",
      durationMs: null,
    };
  }
  const summary = summarizePerformanceEvidence(input);
  expect(summary.failures).toEqual([]);
  expect(summary.processes[0]!.firstElapsedMs).toBe(4000);
  expect(summary.response.unavailable).toBe(2);
});

test("includes CPU before the first observation of a process born during the capture", () => {
  const input = capture();
  for (const sample of input.samples) sample.processes[0]!.startedAt = "2026-10-26T00:00:00.000Z";
  input.samples[0]!.processes = [];
  input.samples[0]!.backend = {
    ...input.samples[0]!.backend,
    runtimeId: null,
    scope: "unavailable",
    state: "unavailable",
    durationMs: null,
  };
  input.samples[1]!.processes[0]!.cpuTimeMs = 1500;
  input.samples[2]!.processes[0]!.cpuTimeMs = 1600;
  input.samples[3]!.processes[0]!.cpuTimeMs = 1700;
  const summary = summarizePerformanceEvidence(input);
  expect(summary.processes[0]).toMatchObject({ cpuTimeMs: 1700, cpuCoverage: "process-lifetime" });
});

test("labels CPU deltas with unknown or earlier process birth as coverage between readings", () => {
  const summary = summarizePerformanceEvidence(capture());
  expect(summary.processes[0]).toMatchObject({ cpuTimeMs: 6000, cpuCoverage: "between-readings" });
});

test("includes native startup memory peaks only for processes born during capture", () => {
  const input = capture();
  for (const sample of input.samples) {
    sample.processes[0]!.startedAt = input.startedAt;
    sample.processes[0]!.peakResidentBytes = 900;
    sample.processes[0]!.peakPhysicalFootprintBytes = 1200;
  }
  expect(summarizePerformanceEvidence(input).processes[0]).toMatchObject({
    peakResidentBytes: 900,
    residentPeakCoverage: "process-lifetime",
    peakPhysicalFootprintBytes: 1200,
    footprintPeakCoverage: "process-lifetime",
  });
  for (const sample of input.samples) sample.processes[0]!.startedAt = "2026-10-25T23:00:00.000Z";
  expect(summarizePerformanceEvidence(input).processes[0]).toMatchObject({
    peakResidentBytes: 500,
    residentPeakCoverage: "observed-samples",
    peakPhysicalFootprintBytes: null,
    footprintPeakCoverage: "observed-samples",
  });
});
