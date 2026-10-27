import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { createProcessSampler } from "./process-sampler";

test("reports native CPU time in milliseconds", async () => {
  const sampler = await createProcessSampler();
  try {
    const before = process.cpuUsage();
    const first = await sampler.read(process.pid);
    while (process.cpuUsage(before).user < 250_000) {
      // Enough CPU work to tolerate coarse native counters without depending on scheduling.
    }
    const second = await sampler.read(process.pid);
    const used = process.cpuUsage(before);
    const expectedMs = (used.user + used.system) / 1000;
    const measuredMs = second!.cpuTimeMs - first!.cpuTimeMs;
    expect(measuredMs).toBeGreaterThan(expectedMs * 0.8);
    expect(measuredMs).toBeLessThan(expectedMs * 1.2);
  } finally {
    sampler.close();
  }
});

test("samples a separate busy process without asking its event loop", async () => {
  const launchedAt = Date.now();
  const child = spawn(process.execPath, ["-e", "process.stdout.write('ready\\n'); while (true) {}"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  const sampler = await createProcessSampler();
  try {
    await new Promise<void>((resolve) => child.stdout.once("data", () => resolve()));
    const first = await sampler.read(child.pid!);
    await Bun.sleep(40);
    const second = await sampler.read(child.pid!);
    expect(first).not.toBeNull();
    expect(second?.processStartId).toBe(first?.processStartId);
    expect(second!.cpuTimeMs).toBeGreaterThan(first!.cpuTimeMs);
    expect(second!.residentBytes).toBeGreaterThan(0);
    // Linux creation times are quantized to kernel clock ticks, not whole boot seconds.
    expect(Date.parse(second!.startedAt!)).toBeGreaterThanOrEqual(launchedAt - 20);
    expect(Date.parse(second!.startedAt!)).toBeLessThanOrEqual(Date.now());
    if (process.platform === "darwin") {
      expect(second!.physicalFootprintBytes).toBeGreaterThan(0);
      expect(second!.peakPhysicalFootprintBytes).toBeGreaterThanOrEqual(second!.physicalFootprintBytes!);
    }
    if (process.platform === "win32") expect(second!.privateCommittedBytes).toBeGreaterThan(0);
  } finally {
    child.kill("SIGKILL");
    sampler.close();
    await new Promise<void>((resolve) => child.once("close", () => resolve()));
  }
});

test("does not turn an exited process into a zero reading", async () => {
  const sampler = await createProcessSampler();
  try {
    expect(await sampler.read(2_147_483_647)).toBeNull();
  } finally {
    sampler.close();
  }
});
