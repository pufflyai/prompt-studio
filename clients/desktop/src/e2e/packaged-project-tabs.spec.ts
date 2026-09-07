import { expect, test } from "@playwright/test";
import { readRuntimeActivity } from "pstdio/runtime";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  readDescriptor,
  removePackagedHome,
  runPackagedCli,
  waitForExit,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

test("opens, switches, closes, and restores project tabs in one packaged window", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home);
    const first = await createPackagedProject(app.page, "Docs");
    const second = await createPackagedProject(app.page, "Agentic design");
    await openPackagedProject(app.page, first.name);
    await expect(app.page.getByText("Recent sessions", { exact: true })).toBeVisible();

    const secondary = app.page.getByRole("button", { name: "Show Secondary Panel" });
    if (await secondary.isVisible()) await secondary.click();
    await app.page
      .locator('[data-workbench-panel-header="secondary"]')
      .getByRole("button", { name: "Add panel" })
      .click();
    await expect.poll(async () => (await readRuntimeActivity(app!.runtime)).terminals).toHaveLength(1);
    const terminal = (await readRuntimeActivity(app.runtime)).terminals[0];
    await app.page.getByRole("option", { name: "Sessions", exact: true }).click();
    await expect(app.page.getByLabel("Main").getByText("No active conversations", { exact: true })).toBeVisible();

    await openPackagedProject(app.page, second.name);
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveCount(2);
    await app.page.getByRole("tab", { name: first.name, exact: true }).click();
    await expect(app.page.getByRole("tab", { name: first.name, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(app.page.getByLabel("Main").getByText("No active conversations", { exact: true })).toBeVisible();
    await openPackagedProject(app.page, first.name);
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveCount(2);

    const screenshot = testInfo.outputPath("desktop-project-tabs.png");
    await app.page.screenshot({ path: screenshot });
    await testInfo.attach("desktop-project-tabs", { path: screenshot, contentType: "image/png" });
    expect(app.browser.contexts()[0].pages()).toHaveLength(1);
    expect(readDescriptor(home)).toMatchObject({ instanceId: app.runtime.instanceId, pid: app.runtime.pid });

    await app.page.getByRole("button", { name: `Close ${first.name}`, exact: true }).click();
    await expect(app.page.getByRole("tab", { name: second.name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect((await readRuntimeActivity(app.runtime)).terminals).toEqual([terminal]);
    await openPackagedProject(app.page, first.name);
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveText([
      second.name,
      first.name,
    ]);

    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
    const runtimeBeforeRelaunch = readDescriptor(home)!;
    await app.finishTrace();
    await app.page.evaluate(() => void window.promptStudioDesktop.quitApp());
    await waitForExit(app.child);
    await app.browser.close();
    app = await launchPackagedApp(home);
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveText([
      second.name,
      first.name,
    ]);
    await expect(app.page.getByRole("tab", { name: first.name, exact: true })).toHaveAttribute("aria-selected", "true");
    expect(readDescriptor(home)).toMatchObject({
      instanceId: runtimeBeforeRelaunch.instanceId,
      pid: runtimeBeforeRelaunch.pid,
    });
    expect(app.browser.contexts()[0].pages()).toHaveLength(1);

    await app.page.getByRole("button", { name: `Close ${first.name}`, exact: true }).click();
    await app.page.getByRole("button", { name: `Close ${second.name}`, exact: true }).click();
    await expect(app.page.getByRole("dialog").getByPlaceholder("Search projects...")).toBeVisible();
    await expect(app.page.getByRole("dialog").getByText(first.name, { exact: true })).toBeVisible();
    await expect(app.page.getByRole("dialog").getByText(second.name, { exact: true })).toBeVisible();
    expect((await readRuntimeActivity(app.runtime)).terminals).toEqual([terminal]);
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(home);
  }
});
