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

// Backend recovery does not use an agent harness. Installing default extensions would put
// package downloads inside the recovery deadline.
const recoveryEnvironment = { PSTDIO_DEFAULT_EXTENSIONS: "[]" };

test("automatically recovers a CLI-started backend and restores the open project", async () => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    expect(await runPackagedCli(home, ["serve"], recoveryEnvironment)).toMatchObject({ exitCode: 0 });
    const original = await waitForDescriptor(home);
    app = await launchPackagedApp(home, recoveryEnvironment);
    expect(app.runtime.pid).toBe(original.pid);
    const project = await createPackagedProject(app, "Attached backend recovery");
    await openPackagedProject(app.page, project);
    const lifecycleStartedAt = await app.lifecyclePage.evaluate(() => performance.timeOrigin);

    crashPackagedRuntime(original.pid);
    await waitForAutomaticRecovery(app);

    expect(app.child.exitCode).toBeNull();
    expect(await app.lifecyclePage.evaluate(() => performance.timeOrigin)).toBe(lifecycleStartedAt);
    await expect(app.page.getByRole("tab", { name: project.name, exact: true })).toBeVisible();
    expect(await runPackagedCli(home, ["projects", "list"])).toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining(project.name),
    });
    await app.finishTrace();
    const close = runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0 });
  } finally {
    await disposePackagedApp(app);
    await removePackagedHome(home);
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
