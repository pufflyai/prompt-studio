import { describe, expect, test } from "bun:test";
import type { RuntimeDescriptor } from "@/features/runtime/runtime-descriptor";
import { createHandler } from ".";

const runtime: RuntimeDescriptor = {
  schemaVersion: 1,
  protocolVersion: 1,
  pid: 1234,
  instanceId: "runtime-one",
  ownerType: "desktop",
  origin: "http://127.0.0.1:43127",
  token: "runtime-secret",
  appVersion: "0.25.2",
  startedAt: "2026-08-06T08:00:00.000Z",
};

describe("serve command", () => {
  test("starts or attaches, promotes persistence, and returns after readiness", async () => {
    const calls: string[] = [];
    const handler = createHandler({
      ensureApi: async () => {
        calls.push("ready");
        return runtime;
      },
      promoteRuntime: async (descriptor) => {
        calls.push(`promote:${descriptor.instanceId}`);
      },
      serveApp: async () => {
        calls.push("foreground");
      },
      log: (message) => calls.push(message),
    });

    await handler({ foreground: false, host: "127.0.0.1", owner: "persistent", port: 0 });

    expect(calls).toEqual(["ready", "promote:runtime-one", "pstdio serve: http://127.0.0.1:43127"]);
  });

  test("runs the internal sidecar in the foreground", async () => {
    let options: unknown;
    const handler = createHandler({
      ensureApi: async () => {
        throw new Error("ensureApi should not run");
      },
      promoteRuntime: async () => {},
      serveApp: async (input) => {
        options = input;
      },
      log: () => {},
    });

    await handler({ foreground: true, host: "127.0.0.1", owner: "desktop", port: 0 });

    expect(options).toEqual({ host: "127.0.0.1", ownerType: "desktop", port: 0 });
  });
});
