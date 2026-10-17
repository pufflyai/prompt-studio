import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import { resumeProcess, suspendProcess } from "../testing/suspend-process";
import { waitForWorkbenchPage } from "./desktop-pages";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  launchPackagedWindow,
  type PackagedWindow,
  readDescriptor,
  removePackagedHome,
  runPackagedCli,
  waitForDescriptor,
  waitForExit,
} from "./packaged-app-helpers";
import { crashPackagedRuntime, waitForAutomaticRecovery } from "./packaged-runtime-recovery";
import { waitForVisibleElement } from "./visible-element-timing";

test("keeps waiting for a slow runtime and opens automatically without replacing its owner", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedWindow | null = null;
  let suspendedPid: number | null = null;
  try {
    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
    const runtime = await waitForDescriptor(home);
    const descriptorPath = join(home, "runtime.json");
    const originalDescriptor = readFileSync(descriptorPath, "utf8");
    suspendProcess(runtime.pid);
    suspendedPid = runtime.pid;

    app = await launchPackagedWindow(home);
    await expect(app.lifecyclePage.getByRole("status")).toContainText("Opening Prompt Studio");
    // Advance the renderer's notice timer without delaying process startup or changing the test allowance.
    const now = Date.now();
    await app.lifecyclePage.clock.install({ time: now });
    await app.lifecyclePage.clock.pauseAt(now + 100);
    await app.lifecyclePage.reload();
    await expect(app.lifecyclePage.getByRole("status")).toContainText("Opening Prompt Studio");
    await app.lifecyclePage.clock.runFor(19_000);
    await expect(app.lifecyclePage.getByText(/This is taking longer than usual/)).not.toBeVisible();
    await app.lifecyclePage.clock.runFor(2_000);
    await expect(app.lifecyclePage.getByText(/This is taking longer than usual/)).toBeVisible();
    expect(await app.lifecyclePage.evaluate(() => window.promptStudioDesktop.getStartupState())).toMatchObject({
      kind: "starting",
    });
    expect(readFileSync(descriptorPath, "utf8")).toBe(originalDescriptor);
    expect(app.browser.contexts()[0]?.pages()).toHaveLength(1);
    expect(await app.lifecyclePage.content()).not.toContain(runtime.token);
    await testInfo.attach("desktop-slow-startup", {
      body: await app.lifecyclePage.screenshot(),
      contentType: "image/png",
    });

    resumeProcess(runtime.pid);
    suspendedPid = null;
    await app.lifecyclePage.clock.resume();
    const workbench = await waitForWorkbenchPage(app.lifecyclePage, runtime.origin);
    await expect(workbench.locator("#root")).not.toBeEmpty();
    expect(readDescriptor(home)).toEqual(runtime);
    expect(app.browser.contexts()[0]?.pages()).toHaveLength(2);

    await app.finishTrace();
    const close = runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0 });
    expect(readDescriptor(home)).toBeNull();
  } finally {
    if (suspendedPid !== null) resumeProcess(suspendedPid);
    await disposePackagedApp(app);
    await removePackagedHome(home);
  }
});

test("keeps an uncertain runtime owner intact until its descriptor is repaired", async () => {
  const home = createPackagedHome();
  let app: PackagedWindow | null = null;
  try {
    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
    const runtime = await waitForDescriptor(home);
    const descriptorPath = join(home, "runtime.json");
    const originalDescriptor = readFileSync(descriptorPath, "utf8");
    const mismatchedDescriptor = JSON.stringify({ ...runtime, instanceId: "different-runtime-instance" });
    writeFileSync(descriptorPath, mismatchedDescriptor);

    app = await launchPackagedWindow(home);
    await expect(app.lifecyclePage.getByRole("heading", { name: "Prompt Studio needs attention" })).toBeVisible();
    expect(await app.lifecyclePage.evaluate(() => window.promptStudioDesktop.getStartupState())).toMatchObject({
      kind: "recovery",
      error: { code: "runtime_ownership_uncertain" },
    });
    expect(readFileSync(descriptorPath, "utf8")).toBe(mismatchedDescriptor);
    const readiness = await fetch(`${runtime.origin}/runtime/ready`, {
      headers: { authorization: `Bearer ${runtime.token}` },
    });
    expect(readiness.ok).toBe(true);
    expect(await readiness.json()).toMatchObject({ instanceId: runtime.instanceId });

    const previousRecovery = await app.lifecyclePage
      .getByRole("heading", { name: "Prompt Studio needs attention", exact: true })
      .elementHandle();
    writeFileSync(descriptorPath, originalDescriptor);
    await app.lifecyclePage.getByRole("button", { name: "Retry", exact: true }).click();
    await previousRecovery!.waitForElementState("hidden");
    const workbench = await waitForWorkbenchPage(app.lifecyclePage, runtime.origin);
    await expect(workbench.locator("#root")).not.toBeEmpty();
    expect(readDescriptor(home)).toEqual(runtime);
    expect(app.browser.contexts()[0]?.pages()).toHaveLength(2);

    await app.finishTrace();
    const close = runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0 });
    expect(readDescriptor(home)).toBeNull();
  } finally {
    await disposePackagedApp(app);
    await removePackagedHome(home);
  }
});

test("quits from recovery after the runtime crashes", async () => {
  const home = createPackagedHome();
  let app: PackagedWindow | null = null;
  try {
    const launched = await launchPackagedApp(home);
    app = launched;
    crashPackagedRuntime(launched.runtime.pid);
    await waitForAutomaticRecovery(launched);
    process.kill(launched.runtime.pid, process.platform === "win32" ? undefined : "SIGKILL");
    await waitForVisibleElement(app.lifecyclePage, '[role="alert"] :is(h1, h2, h3)', "Prompt Studio needs attention");

    await app.lifecyclePage.getByRole("button", { name: "Quit", exact: true }).click();

    await waitForExit(app.child);
  } finally {
    await disposePackagedApp(app);
    await removePackagedHome(home);
  }
});
