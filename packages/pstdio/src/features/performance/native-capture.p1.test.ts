import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { startNativePerformanceCapture } from "./native-capture";

test("keeps kernel CPU and memory evidence when the runtime cannot answer a probe", async () => {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ pid: process.pid,
      heapUsedBytes: process.memoryUsage().heapUsed, externalBytes: process.memoryUsage().external,
      counters: { activeSessions: 0, retainedMessages: 0, subscribers: 0, queuedEvents: 0, queuedBytes: 0, extensionImports: 0 } }) });
    console.log(server.url.origin);
    process.stdin.on("data", () => { console.log("blocked"); const end = performance.now() + 2200; while (performance.now() < end) {} });
  `,
    ],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  const exited = once(child, "close");
  const lines = createInterface({ input: child.stdout });
  let capture: Awaited<ReturnType<typeof startNativePerformanceCapture>> | undefined;
  try {
    const [origin] = await once(lines, "line");
    capture = await startNativePerformanceCapture({
      hostVersion: "fixture",
      onError: (error) => {
        throw error;
      },
      backend: () => ({
        id: "fixture",
        pid: child.pid!,
        scope: "local",
        origin,
        token: "fixture-token",
      }),
    });
    const blocked = once(lines, "line");
    child.stdin.write("block");
    await blocked;
    await capture.sample();
    expect(capture.snapshot().samples.at(-1)?.backend.state).toBe("timeout");
    expect(capture.snapshot().samples.at(-1)?.processes[0]?.residentBytes).toBeGreaterThan(0);
    await capture.sample();
    const samples = capture.snapshot().samples;
    expect(samples.at(-1)?.backend.state).toBe("reply");
    expect(samples.at(-1)?.processes[0]?.cpuTimeMs).toBeGreaterThan(samples[0]!.processes[0]!.cpuTimeMs!);
    await capture.close();
    expect(capture.snapshot().samples).toEqual([]);
  } finally {
    await capture?.close();
    lines.close();
    child.kill("SIGKILL");
    await exited;
  }
});
