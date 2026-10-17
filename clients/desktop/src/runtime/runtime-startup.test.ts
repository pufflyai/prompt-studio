import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeRuntimeDescriptor } from "pstdio/runtime";
import { DesktopRuntimeManager } from "./runtime-manager";

for (const externalRuntime of [false, true]) {
  test(`cancels waiting for ${externalRuntime ? "an external" : "a local"} runtime on quit and preserves its owner`, async () => {
    const home = mkdtempSync(join(tmpdir(), "pstdio-desktop-startup-"));
    const requested = Promise.withResolvers<void>();
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      idleTimeout: 0,
      fetch: () => {
        requested.resolve();
        return new Promise<Response>(() => {});
      },
    });
    const descriptorPath = join(home, "runtime.json");
    writeRuntimeDescriptor(descriptorPath, {
      schemaVersion: 1,
      protocolVersion: 1,
      pid: process.pid,
      instanceId: "starting-runtime",
      ownerType: "persistent",
      origin: `http://127.0.0.1:${server.port!}`,
      token: "isolated-test-token",
      appVersion: "0.43.1",
      startedAt: new Date().toISOString(),
    });
    const originalDescriptor = readFileSync(descriptorPath, "utf8");
    const manager = new DesktopRuntimeManager({
      descriptorPath,
      externalRuntime,
      resolveSidecarPath: () => {
        throw new Error("Must not start a competing runtime");
      },
      onIntentionalShutdown() {},
      onUnexpectedExit() {},
      onPhase() {},
    });

    try {
      const startup = manager.start().catch((error) => error);
      await requested.promise;
      await manager.detach();
      expect(await startup).toBeInstanceOf(Error);
      expect(readFileSync(descriptorPath, "utf8")).toBe(originalDescriptor);
    } finally {
      await manager.detach();
      server.stop(true);
      rmSync(home, { recursive: true, force: true });
    }
  });
}
