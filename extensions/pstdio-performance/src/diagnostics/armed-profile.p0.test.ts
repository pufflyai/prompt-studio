import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { channel } from "node:diagnostics_channel";
import { type ArmedCaptureData, captureArmedProfile } from "./armed-profile";
import { captureProfile } from "./profile";

test("armed captures persist bounded profile windows before completing with an explicit expiry", async () => {
  const checkpoints: ArmedCaptureData[] = [];
  const result = await captureArmedProfile({
    id: randomUUID(),
    durationMs: 180,
    thresholdCpuPercent: 10000,
    windowMs: 40,
    sampleIntervalMs: 20,
    checkpoint: async (data) => {
      checkpoints.push(data);
    },
  });
  expect(checkpoints.length).toBeGreaterThan(2);
  expect(checkpoints[0]?.complete).toBe(false);
  expect(result.data.reason).toBe("expired");
  expect(result.data.complete).toBe(true);
  expect(result.data.profiles).toHaveLength(2);
  expect(result.data.discardedProfileWindows).toBeGreaterThan(0);
  expect(result.data.profiles[0]?.profile.nodes.length).toBeGreaterThan(0);
  expect(result.data.cpu.length).toBeGreaterThan(0);
});

test("CPU threshold triggers a profile with aligned operation evidence", async () => {
  const writing = captureArmedProfile({
    id: randomUUID(),
    durationMs: 3000,
    thresholdCpuPercent: 0.01,
    windowMs: 100,
    sampleIntervalMs: 20,
    checkpoint: async () => {},
  });
  await Bun.sleep(10);
  channel("pstdio.diagnostics.operation").publish({
    kind: "database.query",
    startedAt: new Date().toISOString(),
    durationMs: 1,
  });
  const until = performance.now() + 15;
  while (performance.now() < until) Math.sqrt(Math.random());
  const result = await writing;
  expect(result.data.reason).toBe("threshold");
  expect(result.data.trigger?.cpuPercent).toBeGreaterThanOrEqual(0.01);
  expect(result.data.operations.events.some((event) => event.kind === "database.query")).toBe(true);
});

test("cancellation and failed checkpoints release the profiler and operation listener", async () => {
  const controller = new AbortController();
  const recording = captureArmedProfile({
    id: randomUUID(),
    durationMs: 3000,
    thresholdCpuPercent: 10000,
    signal: controller.signal,
    checkpoint: async () => {},
  });
  await Bun.sleep(10);
  controller.abort();
  await expect(recording).rejects.toThrow();
  expect(channel("pstdio.diagnostics.operation").hasSubscribers).toBe(false);
  await expect(
    captureArmedProfile({
      id: randomUUID(),
      durationMs: 30,
      thresholdCpuPercent: 10000,
      windowMs: 20,
      checkpoint: async () => {
        throw new Error("disk unavailable");
      },
    }),
  ).rejects.toThrow("disk unavailable");
  expect(channel("pstdio.diagnostics.operation").hasSubscribers).toBe(false);
  expect(
    (await captureProfile({ id: randomUUID(), kind: "cpu", durationMs: 10 })).data.profile?.nodes.length,
  ).toBeGreaterThan(0);
});

test("work performed during checkpoint persistence is included in the next CPU profile", async () => {
  function checkpointWork() {
    const until = performance.now() + 150;
    while (performance.now() < until) Math.sqrt(Math.random());
  }
  const result = await captureArmedProfile({
    id: randomUUID(),
    durationMs: 1500,
    thresholdCpuPercent: 60,
    windowMs: 40,
    sampleIntervalMs: 100,
    checkpoint: async (data) => {
      if (!data.complete) checkpointWork();
    },
  });
  expect(result.data.reason).toBe("threshold");
  expect(
    result.data.profiles.some((window) =>
      window.profile.nodes.some((node) => node.callFrame.functionName === "checkpointWork"),
    ),
  ).toBe(true);
});

test("slow asynchronous checkpoints leave CPU windows bounded and coalesce pending writes", async () => {
  let firstCheckpointFinishedAt = 0;
  let writes = 0;
  const result = await captureArmedProfile({
    id: randomUUID(),
    durationMs: 170,
    thresholdCpuPercent: 10000,
    windowMs: 40,
    sampleIntervalMs: 20,
    checkpoint: async (data) => {
      writes++;
      if (!data.complete) {
        await Bun.sleep(250);
        firstCheckpointFinishedAt = Date.now();
      }
    },
  });
  expect(result.data.reason).toBe("expired");
  expect(result.data.profiles).toHaveLength(2);
  expect(result.data.cpu.length).toBeGreaterThan(2);
  expect(Date.parse(result.data.profiles.at(-1)!.finishedAt)).toBeLessThan(firstCheckpointFinishedAt);
  expect(result.data.skippedCheckpoints).toBeGreaterThan(0);
  expect(writes).toBe(2);
});

test("cancelling while the final checkpoint is awaiting I/O releases the profiler immediately", async () => {
  const controller = new AbortController();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const recording = captureArmedProfile({
    id: randomUUID(),
    durationMs: 1000,
    thresholdCpuPercent: 0.01,
    windowMs: 40,
    sampleIntervalMs: 20,
    signal: controller.signal,
    checkpoint: async () => {
      entered.resolve();
      await release.promise;
    },
  });
  await entered.promise;
  controller.abort();
  await expect(recording).rejects.toThrow();
  expect(
    (await captureProfile({ id: randomUUID(), kind: "cpu", durationMs: 10 })).data.profile?.nodes.length,
  ).toBeGreaterThan(0);
  release.resolve();
});

test("profile rollover carries CPU into complete sampling intervals", async () => {
  const result = await captureArmedProfile({
    id: randomUUID(),
    durationMs: 520,
    thresholdCpuPercent: 10000,
    windowMs: 40,
    sampleIntervalMs: 200,
    checkpoint: async () => {},
  });
  expect(result.data.reason).toBe("expired");
  expect(result.data.cpu).toHaveLength(2);
  expect(result.data.cpu.every((reading) => reading.intervalMs >= 200)).toBe(true);
});
