import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import { allowPageClose } from "./lifecycle-actions";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
  waitForExit,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

const fixturePath = dirname(fileURLToPath(import.meta.resolve("workbench-fixture/package.json")));
const fixtureExtensions = {
  PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
    defaultExtensions: [{ source: fixturePath, installName: "workbench-fixture", skipInstall: true }],
  }),
};

const sidenav = (page: Page) => page.locator('[data-workbench-region="sidenav"]');
const row = (page: Page, name: string) =>
  sidenav(page)
    .getByRole("option", { name: new RegExp(`^${name}(?:\\s|$)`) })
    .first();
const top = async (target: Locator) => (await target.boundingBox())!.y;
const expectAbove = (page: Page, upper: string, lower: string) =>
  expect.poll(async () => (await top(row(page, upper))) < (await top(row(page, lower)))).toBe(true);

// The Sidenav's hide/show submenu lists every hideable row.
const toggleRow = async (page: Page, name: string) => {
  await row(page, "Sessions").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide/show items", exact: true }).hover();
  await page
    .locator('[role="menuitem"][data-value^="node:"]')
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
};

const resetSidenav = async (page: Page) => {
  await row(page, "Sessions").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide/show items", exact: true }).hover();
  await page.getByRole("menuitem", { name: "Reset to default", exact: true }).click();
};

// Moving the pinned Search row below Sessions changes both its section order and its slot.
const moveSearchBelowSessions = async (page: Page) => {
  const from = (await row(page, "Search").boundingBox())!;
  const to = (await row(page, "Sessions").boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + from.height / 2 + 8, { steps: 4 });
  await page.mouse.move(from.x + 40, to.y + to.height * 0.75, { steps: 12 });
  await expect(sidenav(page).locator("[data-tree-list-drop-indicator]")).toHaveCount(1);
  await page.mouse.up();
  // dnd-kit swallows clicks for 50ms after a drop so the drop is not also a click.
  await page.waitForTimeout(100);
  await expectAbove(page, "Sessions", "Search");
};

const relaunch = async (app: PackagedApp) => {
  await app.finishTrace();
  await allowPageClose(app.page, () => app.page.evaluate(() => void window.promptStudioDesktop.quitApp()));
  await waitForExit(app.child);
  await app.browser.close();
  // Desktop owned the runtime, so quitting stopped it and the relaunch usually serves the dashboard from a new origin.
  return launchPackagedApp(app.home);
};

test("restores each project's navigation order, placement, and visibility after relaunch", async ({
  browserName: _browserName,
}) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home, fixtureExtensions);
    const alpha = await createPackagedProject(app, "Alpha");
    const beta = await createPackagedProject(app, "Beta");

    await openPackagedProject(app.page, alpha);
    await expect(row(app.page, "Sessions")).toBeVisible({ timeout: 15_000 });
    await toggleRow(app.page, "Workspaces");
    await expect(row(app.page, "Workspaces")).toHaveCount(0);
    await moveSearchBelowSessions(app.page);

    await openPackagedProject(app.page, beta);
    await expect(row(app.page, "Sessions")).toBeVisible({ timeout: 15_000 });
    await toggleRow(app.page, "Search");
    await expect(row(app.page, "Search")).toHaveCount(0);

    app = await relaunch(app);

    await openPackagedProject(app.page, beta);
    await expect(row(app.page, "Sessions")).toBeVisible({ timeout: 15_000 });
    await expect(row(app.page, "Search")).toHaveCount(0);
    await expect(row(app.page, "Workspaces")).toBeVisible();

    await openPackagedProject(app.page, alpha);
    await expect(row(app.page, "Sessions")).toBeVisible({ timeout: 15_000 });
    await expect(row(app.page, "Workspaces")).toHaveCount(0);
    await expectAbove(app.page, "Sessions", "Search");
  } finally {
    await disposePackagedApp(app);
    await removePackagedHome(home);
  }
});

test("keeps a navigation reset after relaunch without changing another project", async ({
  browserName: _browserName,
}) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home, fixtureExtensions);
    const alpha = await createPackagedProject(app, "Alpha");
    const beta = await createPackagedProject(app, "Beta");

    await openPackagedProject(app.page, beta);
    await expect(row(app.page, "Sessions")).toBeVisible({ timeout: 15_000 });
    await toggleRow(app.page, "Search");
    await expect(row(app.page, "Search")).toHaveCount(0);

    await openPackagedProject(app.page, alpha);
    await expect(row(app.page, "Sessions")).toBeVisible({ timeout: 15_000 });
    await toggleRow(app.page, "Workspaces");
    await moveSearchBelowSessions(app.page);
    await resetSidenav(app.page);
    await expect(row(app.page, "Workspaces")).toBeVisible();

    app = await relaunch(app);

    await openPackagedProject(app.page, alpha);
    await expect(row(app.page, "Sessions")).toBeVisible({ timeout: 15_000 });
    await expect(row(app.page, "Workspaces")).toBeVisible();
    await expectAbove(app.page, "Search", "Sessions");

    await openPackagedProject(app.page, beta);
    await expect(row(app.page, "Sessions")).toBeVisible({ timeout: 15_000 });
    await expect(row(app.page, "Search")).toHaveCount(0);
  } finally {
    await disposePackagedApp(app);
    await removePackagedHome(home);
  }
});
