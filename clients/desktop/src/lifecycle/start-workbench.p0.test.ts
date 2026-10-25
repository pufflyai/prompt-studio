import { expect, test } from "bun:test";
import type { ManagedRuntime } from "../runtime/runtime-manager";
import { startWorkbench } from "./start-workbench";

const runtime: ManagedRuntime = {
  external: false,
  descriptor: {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: 1234,
    instanceId: "existing-runtime",
    ownerType: "persistent",
    origin: "http://127.0.0.1:43127",
    token: "test-token",
    appVersion: "0.33.1",
    startedAt: "2026-09-14T00:00:00.000Z",
  },
};

test("loads the attached workbench while lifecycle resources are still loading", async () => {
  const lifecycle = Promise.withResolvers<void>();
  let workbenchLoaded = false;
  const startup = startWorkbench(
    {
      showLifecycle: () => lifecycle.promise,
      showWorkbench: async (descriptor) => {
        expect(descriptor).toBe(runtime.descriptor);
        workbenchLoaded = true;
      },
    },
    { start: async () => runtime },
  );
  try {
    await Promise.resolve();
    await Promise.resolve();
    expect(workbenchLoaded).toBe(true);
  } finally {
    lifecycle.resolve();
    await expect(startup).resolves.toBe(runtime);
  }
});
