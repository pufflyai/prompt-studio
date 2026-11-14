import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

test("reports a failed tab write and recovers when the next tab change can be saved", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    // Tab persistence uses no agent harness; default extension installs would only delay project creation.
    app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    const first = await createPackagedProject(app, "First project");
    const second = await createPackagedProject(app, "Second project");
    const blockedWrite = join(home, "electron-user-data", "project-tabs.json.tmp");
    mkdirSync(blockedWrite);

    await openPackagedProject(app.page, first);
    const systemErrors = app.page.getByRole("button", {
      name: "System errors: Could not save project tabs",
      exact: true,
    });
    await expect(systemErrors).toBeVisible();
    await systemErrors.click();
    const error = app.page.getByLabel("System error list").getByText("Could not save project tabs", { exact: true });
    await expect(error).toBeVisible();
    const screenshot = testInfo.outputPath("desktop-project-tabs-save-error.png");
    await app.page.screenshot({ path: screenshot, animations: "disabled" });
    await testInfo.attach("desktop-project-tabs-save-error", { path: screenshot, contentType: "image/png" });

    rmSync(blockedWrite, { recursive: true });
    await openPackagedProject(app.page, second);
    await expect(error).not.toBeVisible();
    await expect(systemErrors).not.toBeVisible();
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveText([
      first.name,
      second.name,
    ]);
    const saved = JSON.parse(readFileSync(join(home, "electron-user-data", "project-tabs.json"), "utf8"));
    expect(saved).toEqual({ projectIds: [first.id, second.id] });
  } finally {
    await disposePackagedApp(app);
    await removePackagedHome(home);
  }
});

test("opens a project created through the folder picker in its own tab", async ({ browserName: _browserName }) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    // Opening a folder needs no agent harness; default extension installs would only delay creation.
    app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    const existing = await createPackagedProject(app, "Existing project");
    await openPackagedProject(app.page, existing);
    const folder = join(home, "created-folders", "Created project");
    mkdirSync(folder, { recursive: true });

    await app.page.getByRole("button", { name: "Open / create project", exact: true }).click();
    await app.page.getByRole("dialog").getByRole("button", { name: "Create project", exact: true }).click();
    const picker = app.page.getByRole("dialog").filter({ hasText: "Open project folder" });
    const folderPath = picker.getByRole("textbox", { name: "Folder path", exact: true });
    await folderPath.fill(folder);
    await folderPath.press("Enter");
    await picker.getByRole("button", { name: "Open folder", exact: true }).click();

    await expect(app.page.getByRole("tab", { name: "Created project", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveText([
      existing.name,
      "Created project",
    ]);
  } finally {
    await disposePackagedApp(app);
    await removePackagedHome(home);
  }
});
