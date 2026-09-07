import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeRuntimeDescriptor } from "pstdio/runtime";
import { DESKTOP_RUNTIME_TIMEOUT_MS } from "./runtime-controller";
import { DesktopRuntimeManager } from "./runtime-manager";

for (const externalRuntime of [false, true]) {
  test(`recovers from an unresponsive ${externalRuntime ? "external" : "local"} runtime within the startup budget`, async () => {
    const home = mkdtempSync(join(tmpdir(), "pstdio-desktop-timeout-"));
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      idleTimeout: 0,
      fetch: () => new Promise<Response>(() => {}),
    });
    const descriptorPath = join(home, "runtime.json");
    writeRuntimeDescriptor(descriptorPath, {
      schemaVersion: 1,
      protocolVersion: 1,
      pid: process.pid,
      instanceId: "stalled-runtime",
      ownerType: "persistent",
      origin: `http://127.0.0.1:${server.port!}`,
      token: "isolated-test-token",
      appVersion: "0.31.0",
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
      const result = await Promise.race([
        manager.start().then(
          () => "Unexpectedly ready",
          (error) => error.message,
        ),
        Bun.sleep(DESKTOP_RUNTIME_TIMEOUT_MS + 1_000).then(() => "Still starting after the readiness budget"),
      ]);
      expect(result).toContain("runtime_timeout");
      expect(readFileSync(descriptorPath, "utf8")).toBe(originalDescriptor);
    } finally {
      server.stop(true);
      rmSync(home, { recursive: true, force: true });
    }
  }, 20_000);
}
