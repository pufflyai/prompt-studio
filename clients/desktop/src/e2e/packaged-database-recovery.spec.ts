import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import { waitForWorkbenchPage } from "./desktop-pages";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedRecovery,
  type PackagedWindow,
  readDescriptor,
  removePackagedHome,
  runPackagedCli,
  waitForDescriptor,
  waitForExit,
} from "./packaged-app-helpers";

test("explains a database ownership conflict and retries after its owner stops", async ({
  browserName: _browserName,
}, testInfo) => {
  const ownerHome = createPackagedHome();
  const desktopHome = createPackagedHome();
  let app: PackagedWindow | null = null;
  try {
    expect(await runPackagedCli(ownerHome, ["serve"])).toMatchObject({ exitCode: 0 });
    const owner = await waitForDescriptor(ownerHome);
    app = await launchPackagedRecovery(desktopHome, { PSTDIO_DB_PATH: join(ownerHome, "pstdio.db") });
    await expect(app.lifecyclePage.getByRole("heading", { name: "Prompt Studio needs attention" })).toBeVisible();
    await testInfo.attach("database-ownership-recovery", {
      body: await app.lifecyclePage.screenshot(),
      contentType: "image/png",
    });
    expect(await app.lifecyclePage.evaluate(() => window.promptStudioDesktop.getStartupState())).toMatchObject({
      kind: "recovery",
      error: { code: "pglite_ownership_conflict" },
    });
    expect(readDescriptor(desktopHome)).toBeNull();
    expect(readDescriptor(ownerHome)).toEqual(owner);
    expect(
      (await fetch(`${owner.origin}/runtime/ready`, { headers: { authorization: `Bearer ${owner.token}` } })).ok,
    ).toBe(true);

    expect(await runPackagedCli(ownerHome, ["close"])).toMatchObject({ exitCode: 0 });
    await app.lifecyclePage.getByRole("button", { name: "Retry", exact: true }).click();
    const replacement = await waitForDescriptor(desktopHome);
    const workbench = await waitForWorkbenchPage(app.lifecyclePage, replacement.origin);
    await expect(workbench.locator("#root")).not.toBeEmpty();

    await app.finishTrace();
    const close = runPackagedCli(desktopHome, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0 });
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(desktopHome);
    removePackagedHome(ownerHome);
  }
});

test("keeps a damaged database intact and retries after its control file is restored", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedWindow | null = null;
  try {
    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
    expect(await runPackagedCli(home, ["close"])).toMatchObject({ exitCode: 0 });
    const controlPath = join(home, "pstdio.db", "global", "pg_control");
    const originalControl = readFileSync(controlPath);
    const damagedControl = Buffer.alloc(originalControl.length);
    writeFileSync(controlPath, damagedControl);

    app = await launchPackagedRecovery(home);
    await expect(app.lifecyclePage.getByRole("heading", { name: "Prompt Studio needs attention" })).toBeVisible();
    await testInfo.attach("damaged-database-recovery", {
      body: await app.lifecyclePage.screenshot(),
      contentType: "image/png",
    });
    expect(await app.lifecyclePage.evaluate(() => window.promptStudioDesktop.getStartupState())).toMatchObject({
      kind: "recovery",
      error: { code: "pglite_recovery_failure" },
    });
    expect(readFileSync(controlPath)).toEqual(damagedControl);
    const failedRuntime = readDescriptor(home);
    if (failedRuntime) expect(() => process.kill(failedRuntime.pid, 0)).toThrow();

    writeFileSync(controlPath, originalControl);
    await app.lifecyclePage.getByRole("button", { name: "Retry", exact: true }).click();
    const replacement = await waitForDescriptor(home, (runtime) => runtime.instanceId !== failedRuntime?.instanceId);
    const workbench = await waitForWorkbenchPage(app.lifecyclePage, replacement.origin);
    await expect(workbench.locator("#root")).not.toBeEmpty();

    await app.finishTrace();
    const close = runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0 });
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(home);
  }
});
