import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedWindow,
  type PackagedWindow,
  readDescriptor,
  removePackagedHome,
  runPackagedCli,
  waitForDescriptor,
  waitForExit,
} from "./packaged-app-helpers";
import { waitForVisibleElement } from "./visible-element-timing";

test("recovers from a stalled runtime and retries without replacing its owner", async ({
  browserName: _browserName,
}, testInfo) => {
  test.skip(process.platform === "win32", "Suspending a runtime requires POSIX process signals.");
  const home = createPackagedHome();
  let app: PackagedWindow | null = null;
  let suspendedPid: number | null = null;
  try {
    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
    const runtime = await waitForDescriptor(home);
    const descriptorPath = join(home, "runtime.json");
    const originalDescriptor = readFileSync(descriptorPath, "utf8");
    process.kill(runtime.pid, "SIGSTOP");
    suspendedPid = runtime.pid;

    app = await launchPackagedWindow(home);
    await expect(app.page.getByRole("status")).toContainText("Opening Prompt Studio");
    const recoveryAt = await waitForVisibleElement(
      app.page,
      '[role="alert"] :is(h1, h2, h3)',
      "Prompt Studio needs attention",
    );
    testInfo.annotations.push({ type: "stalled-runtime-recovery-ms", description: String(recoveryAt - app.startedAt) });
    expect(await app.page.evaluate(() => window.promptStudioDesktop.getStartupState())).toMatchObject({
      kind: "recovery",
      error: { code: "runtime_timeout" },
    });
    expect(readFileSync(descriptorPath, "utf8")).toBe(originalDescriptor);
    expect(app.browser.contexts()[0]?.pages()).toHaveLength(1);
    expect(await app.page.content()).not.toContain(runtime.token);
    await testInfo.attach("desktop-startup-timeout", {
      body: await app.page.screenshot(),
      contentType: "image/png",
    });

    process.kill(runtime.pid, "SIGCONT");
    suspendedPid = null;
    await app.page.keyboard.press("Tab");
    const retry = app.page.getByRole("button", { name: "Retry", exact: true });
    await expect(retry).toBeFocused();
    await app.page.keyboard.press("Enter");
    await app.page.waitForURL(`${runtime.origin}/`);
    await expect(app.page.locator("#root")).not.toBeEmpty();
    expect(readDescriptor(home)).toEqual(runtime);
    expect(app.browser.contexts()[0]?.pages()).toHaveLength(1);

    await app.finishTrace();
    const close = runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0 });
    expect(readDescriptor(home)).toBeNull();
  } finally {
    if (suspendedPid !== null) process.kill(suspendedPid, "SIGCONT");
    await disposePackagedApp(app);
    removePackagedHome(home);
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
    await expect(app.page.getByRole("heading", { name: "Prompt Studio needs attention" })).toBeVisible();
    expect(await app.page.evaluate(() => window.promptStudioDesktop.getStartupState())).toMatchObject({
      kind: "recovery",
      error: { code: "runtime_ownership_uncertain" },
    });
    expect(readFileSync(descriptorPath, "utf8")).toBe(mismatchedDescriptor);
    const readiness = await fetch(`${runtime.origin}/runtime/ready`, {
      headers: { authorization: `Bearer ${runtime.token}` },
    });
    expect(readiness.ok).toBe(true);
    expect(await readiness.json()).toMatchObject({ instanceId: runtime.instanceId });

    writeFileSync(descriptorPath, originalDescriptor);
    await app.page.getByRole("button", { name: "Retry", exact: true }).click();
    await app.page.waitForURL(`${runtime.origin}/`);
    await expect(app.page.locator("#root")).not.toBeEmpty();
    expect(readDescriptor(home)).toEqual(runtime);
    expect(app.browser.contexts()[0]?.pages()).toHaveLength(1);

    await app.finishTrace();
    const close = runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0 });
    expect(readDescriptor(home)).toBeNull();
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(home);
  }
});
