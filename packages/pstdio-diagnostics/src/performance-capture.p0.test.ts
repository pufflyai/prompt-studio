import { expect, test } from "bun:test";
import { PerformanceCaptureCollector } from "./performance-capture";

const reading = {
  processStartId: "start",
  cpuTimeMs: 20,
  residentBytes: 1024,
  peakResidentBytes: null,
  physicalFootprintBytes: 900,
  peakPhysicalFootprintBytes: 950,
  privateCommittedBytes: null,
};
const backend = { id: "runtime", pid: 12, origin: null, token: null, scope: "local" as const };

test("a pending backend response does not skip the next native collection", async () => {
  const replies: Array<(response: Response) => void> = [];
  const server = Bun.serve({
    port: 0,
    fetch: () => new Promise<Response>((resolve) => replies.push(resolve)),
  });
  let now = 0;
  let reads = 0;
  const capture = new PerformanceCaptureCollector({
    hostVersion: "test",
    platform: process.platform,
    intervalMs: 2000,
    backend: () => ({ ...backend, origin: server.url.origin, token: "test" }),
    readProcess: async () => ({ ...reading, cpuTimeMs: ++reads * 20 }),
    now: () => now,
  });
  const pending: Promise<void>[] = [];
  try {
    pending.push(capture.sample(() => []));
    while (!replies.length) await Bun.sleep(1);
    now = 2000;
    pending.push(capture.sample(() => []));
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(reads).toBe(2);
    while (replies.length < 2) await Bun.sleep(1);
    // A later reply may finish first; captures must still retain their collection order.
    replies[1]!(new Response("unavailable", { status: 503 }));
    replies[0]!(new Response("unavailable", { status: 503 }));
    await Promise.all(pending);
    expect(capture.snapshot().samples.map((sample) => sample.elapsedMs)).toEqual([0, 2000]);
    expect(capture.snapshot().samples.map((sample) => sample.processes[0]?.cpuTimeMs)).toEqual([20, 40]);
    expect(capture.snapshot().samples[1]?.processes[0]?.cpuPercent).toBe(1);
  } finally {
    capture.stop();
    for (const reply of replies) reply(new Response(null, { status: 503 }));
    server.stop(true);
    await Promise.allSettled(pending);
  }
});

test("timestamps each collection before reading native process metrics", async () => {
  let now = 0;
  const capture = new PerformanceCaptureCollector({
    hostVersion: "test",
    platform: "darwin",
    intervalMs: 2000,
    backend: () => null,
    readProcess: async () => null,
    now: () => now,
  });
  const readProcesses = () => {
    now += 1900;
    return [];
  };
  await capture.sample(readProcesses);
  now = 2000;
  await capture.sample(readProcesses);
  expect(now).toBe(3900);
  expect(capture.snapshot().samples.map((sample) => sample.elapsedMs)).toEqual([0, 2000]);
  expect(capture.snapshot().samples[1]?.intervalMs).toBe(2000);
  capture.stop();
});

test("samples an explicit operation boundary after an outstanding periodic sample", async () => {
  const pending = Promise.withResolvers<typeof reading>();
  let reads = 0;
  const capture = new PerformanceCaptureCollector({
    hostVersion: "test",
    platform: "darwin",
    intervalMs: 2000,
    backend: () => backend,
    readProcess: async () => (++reads === 1 ? pending.promise : { ...reading, cpuTimeMs: 120 }),
  });
  const periodic = capture.sample(() => []);
  const boundary = capture.flush(() => []);
  pending.resolve(reading);
  await Promise.all([periodic, boundary]);
  expect(reads).toBe(2);
  expect(capture.snapshot().samples.at(-1)?.processes[0]?.cpuTimeMs).toBe(120);
  capture.stop();
});

test("preserves process identity and bounded history without readers", async () => {
  let cpu = 0;
  let startId = "first";
  let time = 0;
  const capture = new PerformanceCaptureCollector({
    hostVersion: "test",
    platform: "darwin",
    intervalMs: 2000,
    backend: () => backend,
    readProcess: async () => ({ ...reading, cpuTimeMs: cpu, processStartId: startId }),
    now: () => time,
  });
  await capture.sample(() => []);
  cpu = 2000;
  time = 2000;
  await capture.sample(() => []);
  expect(capture.snapshot().samples[1]?.processes[0]?.cpuPercent).toBe(100);
  startId = "replacement";
  cpu = 50;
  time = 4000;
  await capture.sample(() => []);
  expect(capture.snapshot().samples[2]?.processes[0]?.cpuPercent).toBeNull();
  for (let i = 0; i < 200; i++) {
    time += 2000;
    await capture.sample(() => []);
  }
  const snapshot = capture.snapshot();
  expect(snapshot.samples.length).toBe(150);
  expect(snapshot.droppedSamples).toBe(53);
  expect(snapshot.samples.at(-1)?.sequence).toBe(202);
  capture.stop();
});

test("cancels in-flight collection and cannot repopulate disabled history", async () => {
  let finish: (value: typeof reading) => void = () => {};
  const capture = new PerformanceCaptureCollector({
    hostVersion: "test",
    platform: "darwin",
    intervalMs: 2000,
    backend: () => backend,
    readProcess: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const sample = capture.sample(() => []);
  capture.stop();
  finish(reading);
  await sample;
  expect(capture.snapshot().samples).toEqual([]);
});

test("does not sample local processes for a remote connection or multiply concurrent requests", async () => {
  let reads = 0;
  const capture = new PerformanceCaptureCollector({
    hostVersion: "test",
    platform: "darwin",
    intervalMs: 2000,
    backend: () => ({ ...backend, scope: "remote" }),
    readProcess: async () => {
      reads++;
      return reading;
    },
  });
  await Promise.all([capture.sample(() => []), capture.sample(() => [])]);
  expect(reads).toBe(0);
  expect(capture.snapshot().samples).toHaveLength(1);
  expect(capture.snapshot().samples[0]?.backend.scope).toBe("remote");
  capture.stop();
});

test("bounds live history by encoded bytes so the supported local reader remains usable", async () => {
  const capture = new PerformanceCaptureCollector({
    backend: () => null,
    readProcess: async () => null,
    intervalMs: 2000,
    platform: process.platform,
    hostVersion: "test",
  });
  const processes = Array.from({ length: 100 }, (_, pid) => ({
    pid,
    processStartId: String(pid),
    role: "renderer" as const,
    cpuPercent: 1,
    cpuTimeMs: 1,
    residentBytes: 1,
    peakResidentBytes: null,
    physicalFootprintBytes: null,
    peakPhysicalFootprintBytes: null,
    privateCommittedBytes: null,
    heapUsedBytes: null,
    externalBytes: null,
  }));
  for (let index = 0; index < 150; index++) await capture.sample(() => processes);
  expect(Buffer.byteLength(JSON.stringify(capture.snapshot()))).toBeLessThan(600_000);
  expect(capture.snapshot().droppedSamples).toBeGreaterThan(0);
  capture.stop();
});
