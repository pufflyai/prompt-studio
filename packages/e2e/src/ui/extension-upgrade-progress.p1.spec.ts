import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Route, test } from "@playwright/test";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

// Critical risks: retained results must not repeat completed work; recovery stays accessible in the button popover.
test("keeps upgrade progress and retained results inside buttons with accessible recovery", async ({
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
  const activeButton = row(targets[0]!.id).getByTestId("extension-row-upgrade");
  await expect(activeButton).toHaveAttribute("aria-busy", "true");
  const installProgress = activeButton.getByRole("progressbar");
  await expect(installProgress).toBeVisible();
  await expect(installProgress).not.toHaveAttribute("aria-valuenow");
  const buttonBounds = (await activeButton.boundingBox())!;
  const progressBounds = (await installProgress.boundingBox())!;
  const bottomBorder = await activeButton.evaluate((button) =>
    Number.parseFloat(getComputedStyle(button).borderBottomWidth),
  );
  expect(progressBounds.y + progressBounds.height).toBeCloseTo(buttonBounds.y + buttonBounds.height - bottomBorder, 0);
  await expect(page.getByTestId("extensions-upgrade-all").getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await row(targets[0]!.id).click();
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  await expect(page.getByTestId("extension-upgrade")).toBeDisabled();
  await expect(page.getByTestId("extension-upgrade").getByRole("progressbar")).toBeVisible();
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
    const succeededButton = row(waiting[0]!.extension.id).getByTestId("extension-row-upgrade");
    await expect(succeededButton).toContainText("Extension upgraded");
    await succeededButton.click();
    expect(waiting).toHaveLength(3);
    const notification = page.getByTestId("extension-action-notification").and(page.getByRole("dialog"));
    await expect(notification).toContainText("Extension upgraded");
    await notification.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(succeededButton).toHaveCount(0);
    await waiting[1]!.route.fulfill({ status: 400, json: { error: "Registry unavailable" } });
    const failedButton = row(waiting[1]!.extension.id).getByTestId("extension-row-upgrade");
    await expect(failedButton).toContainText("Extension upgrade failed");
    await failedButton.click();
    await expect(notification.getByRole("alert")).toContainText("Registry unavailable");
    await expect(notification.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    // The trigger toggles its anchored notification without starting another request.
    await failedButton.click();
    await expect(notification).toHaveCount(0);
    await succeed(waiting[2]!);
    await expect(page.getByTestId("extensions-upgrade-all").getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    await expect(row(waiting[2]!.extension.id).getByTestId("extension-row-upgrade")).toContainText(
      "Extension upgraded",
    );
    const batchButton = page.getByTestId("extensions-upgrade-all");
    await expect(batchButton).not.toHaveAttribute("aria-busy", "true");
    await batchButton.click();
    await expect(notification.getByRole("alert")).toContainText("1 of 3 upgrades failed");
    await notification.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(batchButton).toContainText("Upgrade all");
    // Dismissing batch feedback preserves the individual failure and its retry.
    await failedButton.click();
    await notification.getByRole("button", { name: "Retry", exact: true }).click();
    await expect.poll(() => waiting.length).toBe(4);
    await expect(failedButton).toHaveAttribute("aria-busy", "true");
    await succeed(waiting[3]!);
    await expect(failedButton).toContainText("Extension upgraded");
    await row(waiting[3]!.extension.id).click();
    await expect(page.getByTestId("extension-upgrade")).toContainText("Extension upgraded");
    await page.getByTestId("extension-upgrade").click();
    await notification.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.getByTestId("extension-upgrade")).toHaveCount(0);
  } finally {
    await Promise.all(heldReads.map((route) => route.abort()));
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});
