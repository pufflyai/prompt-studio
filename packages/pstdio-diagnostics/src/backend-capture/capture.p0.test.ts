import { expect, test } from "bun:test";
import { channel } from "node:diagnostics_channel";
import type { BackendArmedCaptureData } from "pstdio-api-contracts/extension-kernel";
import { runtimeOperationChannel } from "../runtime-operation";
import { captureBackendDiagnostic } from "./capture";

const rejectionOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error as Error & { code?: string },
  );

test("a CPU capture returns profile samples and memory readings of this process", async () => {
  const result = await captureBackendDiagnostic({ kind: "cpu", durationMs: 30 });
  expect(result.data.pid).toBe(process.pid);
  expect(result.data.profile?.nodes.length).toBeGreaterThan(0);
  expect(result.summary.unit).toBe("samples");
  expect(result.summary.memoryAfter.heapUsed).toBeGreaterThan(0);
});

test("a coverage capture counts function calls", async () => {
  const result = await captureBackendDiagnostic({ kind: "coverage", durationMs: 20 });
  expect(result.data.coverage?.length).toBeGreaterThan(0);
  expect(result.summary.unit).toBe("calls");
  expect(result.summary.total).toBeGreaterThan(0);
});

test("a second concurrent capture is refused and cancellation releases the profiler", async () => {
  const controller = new AbortController();
  const first = captureBackendDiagnostic({ kind: "cpu", durationMs: 60_000, signal: controller.signal });
  await Bun.sleep(10);
  const busy = await rejectionOf(captureBackendDiagnostic({ kind: "coverage", durationMs: 20 }));
  expect(busy?.code).toBe("diagnostics_busy");
  const started = performance.now();
  controller.abort();
  expect(await rejectionOf(first)).toBeDefined();
  expect(performance.now() - started).toBeLessThan(1000);
  expect(channel(runtimeOperationChannel).hasSubscribers).toBe(false);
  const next = await captureBackendDiagnostic({ kind: "cpu", durationMs: 20 });
  expect(next.data.profile?.nodes.length).toBeGreaterThan(0);
});

test("captures longer than the limits or with invalid input are refused before profiling", async () => {
  for (const input of [
    { kind: "cpu", durationMs: 60_001 },
    { kind: "coverage", durationMs: 0 },
    { kind: "armed", durationMs: 24 * 60 * 60_000 + 1, cpuPercent: 50 },
    { kind: "armed", durationMs: 1000, cpuPercent: 0 },
    { kind: "heap", durationMs: 1000 },
  ]) {
    const error = await rejectionOf(captureBackendDiagnostic(input as never));
    expect(error?.code).toBe("diagnostics_invalid_input");
  }
});

test("an armed capture writes checkpoints through its callback and returns the final evidence", async () => {
  const checkpoints: BackendArmedCaptureData[] = [];
  const result = await captureBackendDiagnostic(
    {
      kind: "armed",
      durationMs: 180,
      cpuPercent: 10_000,
      checkpoint: (data) => {
        checkpoints.push(data);
      },
    },
    { windowMs: 40, sampleIntervalMs: 20 },
  );
  expect(checkpoints.length).toBeGreaterThan(2);
  expect(checkpoints[0]?.complete).toBe(false);
  expect(checkpoints.at(-1)?.complete).toBe(true);
  expect(result.data.mode).toBe("armed");
  expect(result.data.reason).toBe("expired");
  expect(result.summary.unit).toBe("samples");
});
