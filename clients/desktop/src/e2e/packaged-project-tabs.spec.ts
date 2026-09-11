import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { readRuntimeActivity } from "pstdio/runtime";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  readDescriptor,
  removePackagedHome,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

const fixturePath = dirname(fileURLToPath(import.meta.resolve("workbench-fixture/package.json")));

test("opens and closes project tabs while preserving pages and terminals", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home, {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
        defaultExtensions: [{ source: fixturePath, installName: "workbench-fixture", skipInstall: true }],
      }),
    });
    const first = await createPackagedProject(app.page, "Docs");
    const second = await createPackagedProject(app.page, "Agentic design");
    await openPackagedProject(app.page, first.name);
    await expect(app.page.getByTestId("start-page")).toBeVisible();
    // Electron combines drag regions from both renderers, even when the
    // workbench covers the lifecycle page. Chromium clicks bypass that hit test.
    await expect(app.lifecyclePage.getByRole("main")).not.toBeVisible();

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
    await app.page.getByRole("option", { name: "Lab", exact: true }).click();
    await expect(app.page).toHaveURL(/\/extensions\/[^/]+\/lab$/);
    const firstPageUrl = app.page.url();

    await openPackagedProject(app.page, second.name);
    await app.page.getByRole("option", { name: "Sessions", exact: true }).click();
    await expect(app.page).toHaveURL(/\/sessions$/);
    const secondPageUrl = app.page.url();
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveCount(2);
    await app.page.getByRole("tab", { name: first.name, exact: true }).click();
    await expect(app.page.getByRole("tab", { name: first.name, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(app.page).toHaveURL(firstPageUrl);
    await openPackagedProject(app.page, first.name);
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveCount(2);

    const screenshot = testInfo.outputPath("desktop-project-tabs.png");
    await app.page.screenshot({ path: screenshot });
    await testInfo.attach("desktop-project-tabs", { path: screenshot, contentType: "image/png" });
    expect(app.browser.contexts()[0].pages()).toHaveLength(2);
    expect(readDescriptor(home)).toMatchObject({ instanceId: app.runtime.instanceId, pid: app.runtime.pid });

    await app.page.getByRole("button", { name: `Close ${first.name}`, exact: true }).click();
    await expect(app.page.getByRole("tab", { name: second.name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(app.page).toHaveURL(secondPageUrl);
    expect((await readRuntimeActivity(app.runtime)).terminals).toEqual([terminal]);
    await openPackagedProject(app.page, first.name);
    await expect(app.page).toHaveURL(firstPageUrl);
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveText([
      second.name,
      first.name,
    ]);

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

test("reports a failed tab write and recovers when the next tab change can be saved", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home);
    const first = await createPackagedProject(app.page, "First project");
    const second = await createPackagedProject(app.page, "Second project");
    const blockedWrite = join(home, "electron-user-data", "project-tabs.json.tmp");
    mkdirSync(blockedWrite);

    await openPackagedProject(app.page, first.name);
    const error = app.page.getByText("Could not save project tabs", { exact: true });
    await expect(error).toBeVisible();
    const screenshot = testInfo.outputPath("desktop-project-tabs-save-error.png");
    await app.page.screenshot({ path: screenshot, animations: "disabled" });
    await testInfo.attach("desktop-project-tabs-save-error", { path: screenshot, contentType: "image/png" });

    rmSync(blockedWrite, { recursive: true });
    await openPackagedProject(app.page, second.name);
    await expect(error).not.toBeVisible();
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveText([
      first.name,
      second.name,
    ]);
    const saved = JSON.parse(readFileSync(join(home, "electron-user-data", "project-tabs.json"), "utf8"));
    expect(saved).toEqual({ projectIds: [first.id, second.id] });
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(home);
  }
});
