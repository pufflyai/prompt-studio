import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Route, test } from "@playwright/test";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

// Critical risk: completed upgrades must stop offering Upgrade even while inventory reads are slow.
test("shows queued and active upgrades, keeps failures beside their rows, and adopts completed upgrades immediately", async ({
  page,
  request,
}) => {
  const folder = join(process.env.E2E_HOME!, `upgrade-progress-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Upgrade progress" }, folder),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const inventory = await (await request.get(`${uiOrigin}/v1/projects/${project.id}/extensions`)).json();
  const targets: ProjectExtensionInstance[] = inventory.extensions
    .slice(0, 3)
    .map((extension: ProjectExtensionInstance) => ({ ...extension, canUpgrade: true }));
  expect(targets).toHaveLength(3);
  const waiting: { route: Route; extension: ProjectExtensionInstance }[] = [];
  const heldReads: Route[] = [];
  let holdReads = false;
  await page.route(`**/v1/projects/${project.id}/extensions`, async (route) => {
    if (holdReads) {
      heldReads.push(route);
      return;
    }
    await route.fulfill({ json: { ...inventory, extensions: targets } });
  });
  await page.route(`**/v1/projects/${project.id}/extensions/*/upgrade`, async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    waiting.push({ route, extension: targets.find((extension) => extension.id === id)! });
  });
  await page.addInitScript((projectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  const row = (id: string) =>
    page
      .getByTestId("extension-entry")
      .filter({ hasText: targets.find((extension) => extension.id === id)!.displayName });
  await page.getByTestId("extensions-upgrade-all").click();
  await expect.poll(() => waiting.length).toBe(2);
  await expect(row(targets[2]!.id).getByText("Queued for upgrade")).toBeVisible();
  await expect(row(targets[0]!.id).getByRole("progressbar")).toBeVisible();
  await expect(page.getByTestId("extension-upgrade-progress").getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await row(targets[0]!.id).click();
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  await expect(page.getByTestId("extension-upgrade")).toBeDisabled();
  await expect(page.getByTestId("extension-detail").getByRole("progressbar")).toBeVisible();
  await page.getByTestId("extension-detail-back").click();
  await expect(page.getByTestId("extensions-panel")).toBeVisible();
  expect(waiting).toHaveLength(2);
  const succeed = async (entry: (typeof waiting)[number]) =>
    entry.route.fulfill({
      json: { changed: true, extension: { ...entry.extension, version: "9.9.9", canUpgrade: false } },
    });
  holdReads = true;
  try {
    await succeed(waiting[0]!);
    await expect.poll(() => waiting.length).toBe(3);
    await expect(row(waiting[0]!.extension.id).getByTestId("extension-row-upgrade")).toHaveCount(0);
    await waiting[1]!.route.fulfill({ status: 400, json: { error: "Registry unavailable" } });
    await expect(row(waiting[1]!.extension.id).getByRole("alert")).toContainText("Registry unavailable");
    await expect(row(waiting[1]!.extension.id).getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await succeed(waiting[2]!);
    await expect(page.getByTestId("extension-upgrade-progress").getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    await expect(row(waiting[2]!.extension.id).getByRole("status")).toContainText("Extension upgraded");
  } finally {
    await Promise.all(heldReads.map((route) => route.abort()));
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});
