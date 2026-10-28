import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { stopChildProcess } from "./child-process";
import { stopPendingTestProcesses } from "./pending-test-processes";
import { waitForProcessReady } from "./process-readiness";

// Teardown must interrupt a stalled check while the child still runs.
test("runner cleanup cancels pending readiness and reaps the process", async () => {
  const child = spawn("bun", ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe" });
  const checking = Promise.withResolvers<void>();
  const pending = waitForProcessReady(child, "Fixture", async (signal) => {
    checking.resolve();
    await new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    return true;
  });
  const result = pending.then(
    () => undefined,
    (error: Error) => error,
  );
  await checking.promise;
  await stopPendingTestProcesses();
  expect((await result)?.message).toBe("Test ended before process completed");
  expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  expect(child.listenerCount("exit")).toBe(0);
});

test("failed process launch can be cleaned up without waiting for an exit", async () => {
  const child = spawn("/missing-pstdio-readiness-executable", [], { stdio: "pipe" });
  try {
    const failure = await waitForProcessReady(child, "Fixture", async () => undefined).catch((error: unknown) => error);
    expect(failure).toMatchObject({ message: expect.stringContaining("failed to start") });
    await stopChildProcess(child);
    expect(child.pid).toBeUndefined();
  } finally {
    await stopChildProcess(child);
  }
});

test("ready processes stay owned by their callers during runner cleanup", async () => {
  const child = spawn("bun", ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe" });
  try {
    expect(await waitForProcessReady(child, "Fixture", async () => true)).toBe(true);
    await stopPendingTestProcesses();
    expect(child.exitCode).toBeNull();
    expect(child.signalCode).toBeNull();
  } finally {
    await stopChildProcess(child);
  }
});
