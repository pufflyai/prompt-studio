import { expect, test } from "bun:test";
import type { HarnessContext, HarnessProvider, ProcessRunInput } from "pstdio-api-contracts/extension-kernel";
import { detectHarness } from "./harness-detection";

test("availability waits for process work started by its detection provider", async () => {
  const children: Bun.Subprocess[] = [];
  const run = async (input: ProcessRunInput) => {
    const child = Bun.spawn([...input.command], { stdout: "pipe", stderr: "pipe" });
    children.push(child);
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { exitCode, stdout, stderr };
  };
  const context: HarnessContext = {
    extensionId: "fixture",
    name: "fixture",
    process: {
      run,
      runOrThrow: run,
      spawnDetached: async () => {
        throw new Error("Unused");
      },
    },
    net: { findFreePort: async () => 0 },
    connections: {
      request: async () => {
        throw new Error("Unused");
      },
      stream: async function* () {
        yield await Promise.reject(new Error("Unused"));
      },
    },
    logger: { info() {}, warn() {}, error() {} },
    state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
  };
  const provider: HarnessProvider = {
    id: "fixture",
    ref: { kind: "harness", id: "fixture" },
    label: "Fixture",
    capabilities: () => [],
    start: () => {
      throw new Error("Unused");
    },
    resume: () => {
      throw new Error("Unused");
    },
    detect(ctx) {
      void ctx.process.run({
        command: [process.execPath, "-e", "await Bun.sleep(100); process.stdout.write('probe')"],
      });
      return { available: true };
    },
  };
  try {
    expect(await detectHarness(provider, context)).toEqual({ available: true });
    expect(children).toHaveLength(1);
    expect(() => process.kill(children[0]!.pid, 0)).toThrow();
  } finally {
    for (const child of children) child.kill("SIGKILL");
    await Promise.all(children.map((child) => child.exited));
  }
});
