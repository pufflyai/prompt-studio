import { describe, expect, test } from "bun:test";
import type { RuntimeDescriptor } from "@/features/runtime/runtime-descriptor";
import { createHandler } from "./close";

const runtime: RuntimeDescriptor = {
  schemaVersion: 1,
  protocolVersion: 1,
  pid: 1234,
  instanceId: "runtime-one",
  ownerType: "persistent",
  origin: "http://127.0.0.1:43127",
  token: "runtime-secret",
  appVersion: "0.25.2",
  startedAt: "2026-08-06T08:00:00.000Z",
};

describe("close command", () => {
  test("succeeds when no runtime is running", async () => {
    const output: string[] = [];
    const handler = createHandler({
      discoverRuntime: async () => ({ state: "missing" }),
      requestShutdown: async () => ({ state: "failed" }),
      resolveDescriptorPath: () => "/tmp/runtime.json",
      waitForExit: async () => {},
      log: (message) => output.push(message),
      error: () => {},
      setExitCode: () => {},
    });

    await handler({ force: false });

    expect(output).toEqual(["Runtime is not running."]);
  });

  test("refuses active work without force and prints its stable labels", async () => {
    const errors: string[] = [];
    let exitCode: number | undefined;
    const handler = createHandler({
      discoverRuntime: async () => ({ state: "healthy", descriptor: runtime }),
      requestShutdown: async () => ({
        state: "active",
        activity: {
          sessions: [{ id: "session-one", label: "Implement runtime" }],
          terminals: [{ id: "terminal-one", label: "zsh" }],
          jobs: [],
        },
      }),
      resolveDescriptorPath: () => "/tmp/runtime.json",
      waitForExit: async () => {
        throw new Error("wait should not run");
      },
      log: () => {},
      error: (message) => errors.push(message),
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await handler({ force: false });

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Implement runtime (session-one)");
    expect(errors.join("\n")).toContain("zsh (terminal-one)");
    expect(errors.join("\n")).toContain("pst close --force");
  });

  test("authorizes cancellation and waits indefinitely for graceful exit when forced", async () => {
    const calls: string[] = [];
    const handler = createHandler({
      discoverRuntime: async () => ({ state: "healthy", descriptor: runtime }),
      requestShutdown: async (_runtime, force) => {
        calls.push(`shutdown:${force}`);
        return { state: "accepted" };
      },
      resolveDescriptorPath: () => "/tmp/runtime.json",
      waitForExit: async (path, descriptor) => {
        calls.push(`wait:${path}:${descriptor.instanceId}`);
      },
      log: (message) => calls.push(message),
      error: () => {},
      setExitCode: () => {},
    });

    await handler({ force: true });

    expect(calls).toEqual(["shutdown:true", "wait:/tmp/runtime.json:runtime-one", "Runtime stopped."]);
  });
});
