import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
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
import {
  createPackagedProject,
  dragProjectTab,
  openPackagedProject,
  startKeyboardTabDrag,
} from "./packaged-project-helpers";

const fixturePath = dirname(fileURLToPath(import.meta.resolve("workbench-fixture/package.json")));

test("reorders project tabs with mouse and keyboard and restores their order after restart", async ({
  browserName: _browserName,
}) => {
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
    await openPackagedProject(app.page, second.name);
    await openPackagedProject(app.page, first.name);
    await app.page.getByRole("option", { name: "Lab", exact: true }).click();
    await expect(app.page).toHaveURL(/\/extensions\/[^/]+\/lab$/);
    const firstPageUrl = app.page.url();

    await dragProjectTab(app.page, first.name, second.name);
    const projectTabs = app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab");
    await expect(projectTabs).toHaveText([first.name, second.name]);
    await expect(app.page.getByRole("tab", { name: first.name, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(app.page).toHaveURL(firstPageUrl);
    const firstTab = app.page.getByRole("tab", { name: first.name, exact: true });
    const dragStatus = app.page.getByRole("status");
    const announcedOver = (targetId: string) => dragStatus.filter({ hasText: new RegExp(`${first.id}.*${targetId}`) });
    await firstTab.click();
    await startKeyboardTabDrag(firstTab);
    await expect(announcedOver(first.id)).toHaveCount(1);
    await app.page.keyboard.press("ArrowRight");
    await expect(announcedOver(second.id)).toHaveCount(1);
    await app.page.keyboard.press("Space");
    await expect(projectTabs).toHaveText([second.name, first.name]);
    await firstTab.click();
    await startKeyboardTabDrag(firstTab);
    await expect(announcedOver(first.id)).toHaveCount(1);
    await app.page.keyboard.press("ArrowLeft");
    await expect(announcedOver(second.id)).toHaveCount(1);
    await app.page.keyboard.press("Escape");
    await expect(projectTabs).toHaveText([second.name, first.name]);
    await dragProjectTab(app.page, first.name, second.name);
    await expect(projectTabs).toHaveText([first.name, second.name]);

    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
    const runtimeBeforeRelaunch = readDescriptor(home)!;
    await app.finishTrace();
    await app.page.evaluate(() => void window.promptStudioDesktop.quitApp());
    await waitForExit(app.child);
    await app.browser.close();
    app = await launchPackagedApp(home);
    await expect(app.page.getByRole("tablist", { name: "Project tabs" }).getByRole("tab")).toHaveText([
      first.name,
      second.name,
    ]);
    await expect(app.page).toHaveURL(firstPageUrl);
    await expect(app.page.getByRole("tab", { name: first.name, exact: true })).toHaveAttribute("aria-selected", "true");
    expect(readDescriptor(home)).toMatchObject({
      instanceId: runtimeBeforeRelaunch.instanceId,
      pid: runtimeBeforeRelaunch.pid,
    });
    expect(app.browser.contexts()[0].pages()).toHaveLength(2);
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(home);
  }
});
