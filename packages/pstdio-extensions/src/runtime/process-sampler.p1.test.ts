import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { createProcessSampler } from "./process-sampler";

test("samples a separate busy process without asking its event loop", async () => {
  const child = spawn(process.execPath, ["-e", "process.stdout.write('ready\\n'); while (true) {}"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  const sampler = await createProcessSampler();
  try {
    await new Promise<void>((resolve) => child.stdout.once("data", () => resolve()));
    const first = await sampler.read(child.pid!);
    const identity = (await sampler.list()).find((process) => process.pid === child.pid);
    expect(identity?.parentPid).toBe(process.pid);
    await Bun.sleep(40);
    const second = await sampler.read(child.pid!);
    expect(first).not.toBeNull();
    expect(second?.processStartId).toBe(first?.processStartId);
    expect(second!.cpuTimeMs).toBeGreaterThan(first!.cpuTimeMs);
    expect(second!.residentBytes).toBeGreaterThan(0);
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

test("kernel CPU time agrees with the process CPU clock in milliseconds", async () => {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
    console.log('ready');
    process.stdin.once('data', () => {
      const before = process.cpuUsage();
      const until = Date.now() + 200;
      while (Date.now() < until) {};
      console.log(JSON.stringify(process.cpuUsage(before)));
    });
    setInterval(() => {}, 1000);
  `,
    ],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  const lines = createInterface({ input: child.stdout });
  const ready = once(lines, "line");
  const sampler = await createProcessSampler();
  try {
    await ready;
    const first = await sampler.read(child.pid!);
    const result = once(lines, "line");
    child.stdin.write("go");
    const [line] = await result;
    const usage = JSON.parse(line);
    const second = await sampler.read(child.pid!);
    const processMs = (usage.user + usage.system) / 1000;
    const sampledMs = second!.cpuTimeMs - first!.cpuTimeMs;
    // Linux's process clock is quantized; transport and reporting also use some CPU.
    expect(Math.abs(sampledMs - processMs)).toBeLessThan(Math.max(20, processMs * 0.2));
  } finally {
    const exited = once(child, "close");
    child.kill("SIGKILL");
    lines.close();
    sampler.close();
    await exited;
  }
});
