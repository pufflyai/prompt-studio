import { join } from "node:path";
import { expect } from "@playwright/test";
import { observeRuntimeShutdown } from "pstdio/runtime";
import { DesktopRuntimeManager } from "../runtime/runtime-manager";
import { test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
  runPackagedCli,
  waitForDescriptor,
  waitForExit,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";
import { crashPackagedRuntime, waitForAutomaticRecovery } from "./packaged-runtime-recovery";

test("automatically recovers a CLI-started backend and restores the open project", async () => {
  // Cold extension installation, recovery, and shutdown share this allowance (approved 2026-10-31).
  if (process.platform === "darwin" && process.arch === "arm64") test.setTimeout(60_000);
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    const original = await test.step("Start the CLI backend", async () => {
      expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
      return waitForDescriptor(home);
    });
    const desktop = await test.step("Attach the desktop to the CLI backend", () => launchPackagedApp(home));
    app = desktop;
    expect(desktop.runtime.pid).toBe(original.pid);
    const project = await test.step("Create the project", () =>
      createPackagedProject(desktop, "Attached backend recovery"));
    await test.step("Open the project", () => openPackagedProject(desktop.page, project));
    const lifecycleStartedAt = await desktop.lifecyclePage.evaluate(() => performance.timeOrigin);

    await test.step("Crash the backend and wait for automatic recovery", async () => {
      crashPackagedRuntime(original.pid);
      await waitForAutomaticRecovery(desktop);
    });

    await test.step("Verify the restored project and original lifecycle page", async () => {
      expect(desktop.child.exitCode).toBeNull();
      expect(await desktop.lifecyclePage.evaluate(() => performance.timeOrigin)).toBe(lifecycleStartedAt);
      await expect(desktop.page.getByRole("tab", { name: project.name, exact: true })).toBeVisible();
    });
    await test.step("Read the recovered project through the CLI", async () => {
      expect(await runPackagedCli(home, ["projects", "list"])).toMatchObject({
        exitCode: 0,
        stdout: expect.stringContaining(project.name),
      });
    });
    await test.step("Save the recovery trace", () => desktop.finishTrace());
    await test.step("Close the recovered backend and desktop", async () => {
      const close = runPackagedCli(home, ["close"]);
      await waitForExit(desktop.child);
      expect(await close).toMatchObject({ exitCode: 0 });
    });
  } finally {
    await test.step("Release packaged resources", async () => {
      await disposePackagedApp(app);
      await removePackagedHome(home);
    });
  }
});

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
    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
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
