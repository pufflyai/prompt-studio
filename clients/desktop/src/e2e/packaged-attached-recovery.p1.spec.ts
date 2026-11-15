import { join } from "node:path";
import { expect } from "@playwright/test";
import { observeRuntimeShutdown } from "pstdio/runtime";
import { DesktopRuntimeManager } from "../runtime/runtime-manager";
import { test } from "../testing/packaged-fixture";
import { createPackagedHome, removePackagedHome, runPackagedCli } from "./packaged-app-helpers";

// Backend recovery does not use an agent harness. Installing default extensions would put
// package downloads inside the recovery deadline.
const recoveryEnvironment = { PSTDIO_DEFAULT_EXTENSIONS: "[]" };

test("preserves packaged CLI shutdown intent when desktop misses the control event", async () => {
  const home = createPackagedHome();
  const disconnected = Promise.withResolvers<void>();
  const reconnect = Promise.withResolvers<void>();
  const intentional = Promise.withResolvers<void>();
  const failures: string[] = [];
  const manager = new DesktopRuntimeManager(
    {
      descriptorPath: join(home, "runtime.json"),
      resolveSidecarPath: () => {
        throw new Error("Intentional shutdown must not spawn another backend");
      },
      onIntentionalShutdown: () => intentional.resolve(),
      onUnexpectedExit: (detail) => failures.push(detail),
      onPhase() {},
    },
    {
      observeRuntimeShutdown: (descriptor, onShutdown, _fetch, signal, onDisconnect) =>
        observeRuntimeShutdown(
          descriptor,
          onShutdown,
          async () => {
            disconnected.resolve();
            await reconnect.promise;
            throw new Error("Control stream disconnected");
          },
          signal,
          onDisconnect,
        ),
    },
  );
  try {
    expect(await runPackagedCli(home, ["serve"], recoveryEnvironment)).toMatchObject({ exitCode: 0 });
    await manager.start();
    await disconnected.promise;
    expect(await runPackagedCli(home, ["close"])).toMatchObject({ exitCode: 0 });
    reconnect.resolve();
    await intentional.promise;
    expect(failures).toEqual([]);
  } finally {
    reconnect.resolve();
    await manager.detach();
    await removePackagedHome(home);
  }
});
