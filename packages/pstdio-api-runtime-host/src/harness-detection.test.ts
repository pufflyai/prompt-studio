import { expect, test } from "bun:test";
import type { HarnessContext, HarnessProvider, ProcessRunInput } from "pstdio-api-contracts/extension-kernel";
import { detectHarness } from "./harness-detection";

const createProbe = () => {
  const entries: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const log = (message: string, metadata?: Record<string, unknown>) => entries.push({ message, metadata });
  const run: HarnessContext["process"]["run"] = async (input) => {
    const child = Bun.spawn(input.command, { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exitCode };
  };
  const context: HarnessContext = {
    extensionId: "test.probe",
    name: "probe",
    process: { run, runOrThrow: run, spawnDetached: async () => ({ pid: 0 }) },
    logger: { info: log, warn: log, error: log },
    net: { findFreePort: async () => 0 },
    connections: {
      request: async () => undefined as never,
      stream: async function* () {},
    },
    state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
  };
  const provider = (detect: NonNullable<HarnessProvider["detect"]>): HarnessProvider => ({
    id: "probe",
    ref: { kind: "harness", id: "probe" },
    label: "Probe",
    capabilities: () => [],
    start: () => ({ done: Promise.resolve({ status: "completed" }), stop() {} }),
    resume: () => ({ done: Promise.resolve({ status: "completed" }), stop() {} }),
    detect,
  });
  return { entries, context, provider };
};

test("detection records a real process probe without recording its command or output", async () => {
  const probe = createProbe();
  const result = { available: true, version: "1.0.0" };
  const detected = await detectHarness(
    probe.provider(async (ctx) => {
      const processResult = await ctx.process.run({
        command: [process.execPath, "-e", 'console.log("private-process-output")'],
        env: { PRIVATE_VALUE: "private-env-value" },
      });
      expect(processResult.stdout.trim()).toBe("private-process-output");
      return result;
    }),
    probe.context,
  );
  expect(detected).toBe(result);
  const phases = probe.entries.map((entry) => entry.metadata);
  expect(phases.map((entry) => [entry?.phase, entry?.state])).toEqual([
    ["provider", "started"],
    ["process.run", "started"],
    ["process.run", "completed"],
    ["provider", "completed"],
  ]);
  expect(new Set(phases.map((entry) => entry?.detection_id)).size).toBe(1);
  for (const entry of phases.filter((entry) => entry?.state === "completed")) {
    expect(entry?.duration_ms).toBeGreaterThanOrEqual(0);
    expect(phases.find((start) => start?.span_id === entry?.span_id)?.state).toBe("started");
  }
  expect(JSON.stringify(probe.entries)).not.toContain("private-process-output");
  expect(JSON.stringify(probe.entries)).not.toContain("private-env-value");
  expect(JSON.stringify(probe.entries)).not.toContain(process.execPath);
});

test("detection identifies a provider error without recording the thrown value", async () => {
  const probe = createProbe();
  const detection = await detectHarness(
    probe.provider(() => {
      throw new Error("private-provider-output");
    }),
    probe.context,
  );
  expect(detection.available).toBe(false);
  expect(probe.entries.at(-1)?.metadata).toMatchObject({
    event: "harness.detection.failed",
    harness_id: "probe",
    failure: "provider_error",
  });
  expect(probe.entries.map((entry) => entry.metadata?.state).filter(Boolean)).toEqual(["started", "failed"]);
  expect(JSON.stringify(probe.entries)).not.toContain("private-provider-output");
});

test("detection identifies its own deadline while the provider is still pending", async () => {
  const probe = createProbe();
  let finish: (value: { available: boolean }) => void = () => {};
  const pending = new Promise<{ available: boolean }>((resolve) => {
    finish = resolve;
  });
  const detection = await detectHarness(
    probe.provider(() => pending),
    probe.context,
  );
  expect(detection.available).toBe(false);
  expect(probe.entries.at(-1)?.metadata).toMatchObject({
    event: "harness.detection.failed",
    failure: "deadline",
  });
  expect(probe.entries.some((entry) => entry.metadata?.state === "completed")).toBe(false);
  finish({ available: true });
  await pending;
});

test("detection preserves a process error that a provider handles", async () => {
  const probe = createProbe();
  const original = new Error("private-process-error");
  probe.context.process.runOrThrow = async () => {
    throw original;
  };
  const result = { available: false, reason: "The CLI could not run." };
  const detection = await detectHarness(
    probe.provider(async (ctx) => {
      try {
        await ctx.process.runOrThrow({ command: ["private-command"] });
      } catch (error) {
        expect(error).toBe(original);
        return result;
      }
      throw new Error("Expected process failure");
    }),
    probe.context,
  );
  expect(detection).toBe(result);
  expect(probe.entries.map((entry) => [entry.metadata?.phase, entry.metadata?.state])).toEqual([
    ["provider", "started"],
    ["process.runOrThrow", "started"],
    ["process.runOrThrow", "failed"],
    ["provider", "completed"],
  ]);
  expect(JSON.stringify(probe.entries)).not.toContain("private-process-error");
  expect(JSON.stringify(probe.entries)).not.toContain("private-command");
});

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
