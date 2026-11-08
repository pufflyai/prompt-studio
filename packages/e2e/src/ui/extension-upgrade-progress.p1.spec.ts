import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Route, test } from "@playwright/test";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

// Critical risks: real queue ownership and directly reachable recovery must survive list/detail navigation.
test("distinguishes waiting from active upgrades and dismisses grouped results without navigation", async ({
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
  await expect(row(targets[2]!.id).getByTestId("extension-row-upgrade")).toHaveText("Waiting");
  await expect(row(targets[2]!.id).getByTestId("extension-row-upgrade")).not.toHaveAttribute("aria-busy", "true");
  for (const target of targets.slice(0, 2)) {
    const button = row(target.id).getByTestId("extension-row-upgrade");
    await expect(button).toContainText("Upgrading");
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(row(target.id).getByRole("progressbar")).toHaveCount(0);
  }
  await expect(page.getByTestId("extensions-upgrade-all").getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await row(targets[0]!.id).click();
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  await expect(page.getByTestId("extension-upgrade")).toBeDisabled();
  await expect(page.getByTestId("extension-upgrade").getByRole("progressbar")).toHaveCount(0);
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
    const succeededRow = row(waiting[0]!.extension.id);
    const succeededButton = succeededRow.getByTestId("extension-row-upgrade");
    await expect(succeededButton).toHaveAttribute("aria-label", "Extension upgraded");
    await succeededRow.getByTestId("extension-action-dismiss").click();
    await expect(page.getByTestId("extensions-panel")).toBeVisible();
    expect(waiting).toHaveLength(3);
    await expect(succeededButton).toHaveCount(0);
    await waiting[1]!.route.fulfill({ status: 400, json: { error: "Registry unavailable" } });
    const failedButton = row(waiting[1]!.extension.id).getByTestId("extension-row-upgrade");
    await expect(failedButton.getByRole("alert")).toContainText("Registry unavailable");
    await expect(failedButton).toContainText("Retry");
    await expect(failedButton).not.toContainText(/\d+s/);
    await succeed(waiting[2]!);
    const batchButton = page.getByTestId("extensions-upgrade-all");
    await expect(batchButton.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    await expect(batchButton).toContainText("1 of 3 upgrades failed");
    await expect(batchButton).not.toContainText(/\d+s/);
    await batchButton.locator("..").getByTestId("extension-action-dismiss").click();
    await expect(batchButton).toContainText("Upgrade all");
    // Batch dismissal preserves the individual failure and its direct retry action.
    await failedButton.click();
    await expect.poll(() => waiting.length).toBe(4);
    await expect(failedButton).toHaveAttribute("aria-busy", "true");
    await succeed(waiting[3]!);
    await expect(failedButton).toHaveAttribute("aria-label", "Extension upgraded");
    await row(waiting[3]!.extension.id).click();
    await expect(page.getByTestId("extension-upgrade")).toHaveAttribute("aria-label", "Extension upgraded");
    await page.getByTestId("extension-detail").getByTestId("extension-action-dismiss").click();
    await expect(page.getByTestId("extension-upgrade")).toHaveCount(0);
    expect(waiting).toHaveLength(4);
  } finally {
    await Promise.all(heldReads.map((route) => route.abort()));
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

// Critical risk: the catalog name owns an install before an instance id exists; its result must follow it.
test("retains fresh-install retry and dismiss ownership from marketplace through installed list and detail", async ({
  page,
  request,
}) => {
  const folder = join(process.env.E2E_HOME!, `install-feedback-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Install feedback" }, folder),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const inventory = await (await request.get(`${uiOrigin}/v1/projects/${project.id}/extensions`)).json();
  const catalog = {
    installName: "grouped-install-fixture",
    extensionId: "example.grouped-install",
    displayName: "Grouped install fixture",
    description: "Fresh install feedback",
    installed: false,
    origin: { kind: "git", url: "https://example.com/tools.git", ref: "main", path: "grouped" },
  };
  const instance: ProjectExtensionInstance = {
    ...inventory.extensions[0],
    id: "grouped-installed-instance",
    installName: catalog.installName,
    extensionId: catalog.extensionId,
    displayName: catalog.displayName,
    canUpgrade: false,
    version: "1.0.0",
  };
  let installed = false;
  const installs: Route[] = [];
  await page.route(`**/v1/projects/${project.id}/extensions`, async (route) => {
    await route.fulfill({
      json: {
        ...inventory,
        extensions: installed ? [...inventory.extensions, instance] : inventory.extensions,
        marketplace: [...inventory.marketplace, { ...catalog, installed }],
      },
    });
  });
  await page.route(`**/v1/projects/${project.id}/extensions/install`, (route) => {
    installs.push(route);
  });
  await page.addInitScript((id) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  const availableRow = page.getByTestId("marketplace-extension-entry").filter({ hasText: catalog.displayName });
  await availableRow.getByTestId("marketplace-extension-install").click();
  await expect.poll(() => installs.length).toBe(1);
  await expect(availableRow.getByTestId("marketplace-extension-install")).toContainText("Installing");
  await expect(availableRow.getByRole("progressbar")).toHaveCount(0);
  await availableRow.click();
  const availableButton = page.getByTestId("available-extension-install");
  await expect(availableButton).toHaveAttribute("aria-busy", "true");
  await installs[0]!.fulfill({ status: 400, json: { error: "Registry unavailable" } });
  await expect(availableButton.getByRole("alert")).toContainText("Registry unavailable");
  await expect(availableButton).toContainText("Retry");
  await expect(availableButton).not.toContainText(/\d+s/);
  await availableButton.click();
  await expect.poll(() => installs.length).toBe(2);
  await expect(availableButton).toHaveAttribute("aria-busy", "true");
  installed = true;
  await installs[1]!.fulfill({ json: { extension: instance } });
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  await expect(page.getByTestId("extension-upgrade")).toHaveAttribute("aria-label", "Installed");
  await page.getByTestId("extension-detail-back").click();
  const installedRow = page.getByTestId("extension-entry").filter({ hasText: catalog.displayName });
  await expect(installedRow.getByTestId("extension-row-upgrade")).toHaveAttribute("aria-label", "Installed");
  await installedRow.click();
  await expect(page.getByTestId("extension-upgrade")).toHaveAttribute("aria-label", "Installed");
  await page.getByTestId("extension-detail").getByTestId("extension-action-dismiss").click();
  await expect(page.getByTestId("extension-upgrade")).toHaveCount(0);
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  expect(installs).toHaveLength(2);
  await page.getByTestId("extension-detail-back").click();
  await expect(installedRow.getByTestId("extension-row-upgrade")).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
