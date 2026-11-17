import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { captureProfile } from "./profile";

test("captures a real backend CPU profile and memory readings", async () => {
  const result = await captureProfile({ id: randomUUID(), kind: "cpu", durationMs: 30 });
  expect(result.data.pid).toBe(process.pid);
  expect(result.data.profile?.nodes.length).toBeGreaterThan(0);
  expect(result.summary.unit).toBe("samples");
  expect(result.summary.memoryAfter.heapUsed).toBeGreaterThan(0);
});

test("captures real function-call coverage", async () => {
  const result = await captureProfile({ id: randomUUID(), kind: "coverage", durationMs: 20 });
  expect(result.data.coverage?.length).toBeGreaterThan(0);
  expect(result.summary.unit).toBe("calls");
  expect(result.summary.total).toBeGreaterThan(0);
});

test("cancellation releases the runtime profiler and concurrent captures cannot overlap", async () => {
  const controller = new AbortController();
  const first = captureProfile({ id: randomUUID(), kind: "cpu", durationMs: 1000, signal: controller.signal });
  await Bun.sleep(10);
  const rejected = expect(captureProfile({ id: randomUUID(), kind: "coverage", durationMs: 20 })).rejects.toThrow(
    "already running",
  );
  controller.abort();
  await expect(first).rejects.toThrow();
  await rejected;
  expect(
    (await captureProfile({ id: randomUUID(), kind: "cpu", durationMs: 20 })).data.profile?.nodes.length,
  ).toBeGreaterThan(0);
});
