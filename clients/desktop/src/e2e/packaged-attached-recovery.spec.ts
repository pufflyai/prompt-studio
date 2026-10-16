import { expect } from "@playwright/test";
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
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
    const original = await waitForDescriptor(home);
    app = await launchPackagedApp(home);
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
