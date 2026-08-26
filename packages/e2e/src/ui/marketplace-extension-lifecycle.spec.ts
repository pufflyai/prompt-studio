import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
    );
  }, projectId);
};

const createRepo = () => {
  const home = process.env.E2E_HOME;
  if (!home) throw new Error("E2E_HOME is required for marketplace extension tests.");
  const repoPath = join(home, `marketplace-extension-${Date.now()}-${process.pid}`);
  mkdirSync(repoPath, { recursive: true });
  const initialized = spawnSync("git", ["init"], { cwd: repoPath, encoding: "utf8" });
  if (initialized.status !== 0) throw new Error(initialized.stderr || initialized.stdout);
  return repoPath;
};

const openExtensions = async (page: import("@playwright/test").Page, projectId: string) => {
  await bypassOnboarding(page, projectId);
  await page.goto(`/projects/${projectId}`);
  await page.getByText("Settings", { exact: true }).last().click();
  const settings = page.getByRole("dialog").last();
  await settings.getByText("Extensions", { exact: true }).first().click();
  await expect(page.getByTestId("extensions-panel")).toBeVisible();
};

const holdProjectExtensionReads = async (page: import("@playwright/test").Page, projectId: string) => {
  const pattern = `**/v1/projects/${projectId}/extensions**`;
  const held: import("@playwright/test").Route[] = [];
  await page.route(pattern, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const shouldHold =
      request.method() === "GET" &&
      (pathname === `/v1/projects/${projectId}/extensions` ||
        pathname.endsWith("/extensions/ui") ||
        pathname.endsWith("/contributions"));
    if (shouldHold) {
      held.push(route);
      return;
    }
    await route.continue();
  });

  return {
    wait: () =>
      expect
        .poll(() => held.length, { message: "background extension reconciliation was not requested" })
        .toBeGreaterThan(0),
    release: async () => {
      await page.unroute(pattern);
      await Promise.all(held.splice(0).map((route) => route.continue().catch(() => undefined)));
    },
  };
};

test("deletes, installs, disables, and enables a Marketplace extension without stale lists", async ({
  page,
  request,
}) => {
  const repoPath = createRepo();
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: `Marketplace extension ${Date.now()}` },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };

  const repoResponse = await request.post(`${apiBase}/v1/projects/${project.id}/repos`, {
    data: { name: "marketplace-extension", path: repoPath },
  });
  expect(repoResponse.status(), await repoResponse.text()).toBe(201);

  const initialInstallResponse = await request.post(
    `${apiBase}/v1/projects/${project.id}/extensions/marketplace/pstdio-planner-loops/install`,
  );
  expect(initialInstallResponse.status(), await initialInstallResponse.text()).toBe(200);

  const listResponse = await request.get(`${apiBase}/v1/projects/${project.id}/extensions`);
  expect(listResponse.ok()).toBe(true);
  const list = (await listResponse.json()) as {
    extensions: Array<{ enabled: boolean; id: string; installName: string }>;
  };
  const installed = list.extensions.find((extension) => extension.installName === "pstdio-planner-loops");
  expect(installed).toMatchObject({ enabled: true });
  expect(existsSync(join(repoPath, ".pstdio/extensions/pstdio-planner-loops/package.json"))).toBe(true);

  await openExtensions(page, project.id);
  const installedRow = page.getByTestId("extension-entry").filter({ hasText: "Prompt Studio Planner Automation" });
  const availableRow = page
    .getByTestId("marketplace-extension-entry")
    .filter({ hasText: "Prompt Studio Planner Automation" });

  await expect(installedRow).toBeVisible();
  await expect(availableRow).toHaveCount(0);

  await installedRow.click();
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByTestId("extension-delete").click();
  const dialog = page.getByRole("dialog").last();
  await dialog.getByText("Also delete this extension's data", { exact: false }).click();
  const deleteReads = await holdProjectExtensionReads(page, project.id);
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/v1/projects/${project.id}/extensions/`) && response.request().method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  expect((await deleteResponse).status()).toBe(204);

  await expect(page.getByTestId("extensions-panel")).toBeVisible();
  await expect(installedRow).toHaveCount(0);
  await expect(availableRow).toBeVisible();
  expect(existsSync(join(repoPath, ".pstdio/extensions/pstdio-planner-loops/package.json"))).toBe(false);

  await deleteReads.wait();
  await deleteReads.release();

  const installReads = await holdProjectExtensionReads(page, project.id);
  const installResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/extensions/marketplace/pstdio-planner-loops/install") &&
      response.request().method() === "POST",
  );
  await availableRow.getByTestId("marketplace-extension-install").click();
  expect((await installResponse).status()).toBe(200);
  await expect(installedRow).toBeVisible();
  await expect(availableRow).toHaveCount(0);
  expect(existsSync(join(repoPath, ".pstdio/extensions/pstdio-planner-loops/package.json"))).toBe(true);
  await installReads.wait();
  await installReads.release();

  const checkbox = installedRow.locator("input[type='checkbox']");
  const visibleSwitch = installedRow.locator("[data-scope='switch'][data-part='control']");
  await expect(checkbox).toBeChecked();

  const disableReads = await holdProjectExtensionReads(page, project.id);
  const disableResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes(`/extensions/`),
  );
  await visibleSwitch.click();
  expect((await disableResponse).status()).toBe(200);
  await expect(checkbox).not.toBeChecked();
  await disableReads.wait();
  await disableReads.release();

  const enableReads = await holdProjectExtensionReads(page, project.id);
  const enableResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes(`/extensions/`),
  );
  await visibleSwitch.click();
  expect((await enableResponse).status()).toBe(200);
  await expect(checkbox).toBeChecked();
  await enableReads.wait();
  await enableReads.release();

  await installedRow.click();
  const automationRow = page.getByTestId("extension-automation-row").filter({ hasText: "Refine backlog tickets" });
  await expect(automationRow).toBeVisible();
  const automationCheckbox = automationRow.locator("input[type='checkbox']");
  const automationSwitch = automationRow.locator("[data-scope='switch'][data-part='control']");
  await expect(automationCheckbox).toBeChecked();

  const disableAutomationReads = await holdProjectExtensionReads(page, project.id);
  const disableAutomationResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes("/automations/"),
  );
  await automationSwitch.click();
  expect((await disableAutomationResponse).status()).toBe(200);
  await expect(automationCheckbox).not.toBeChecked();
  await page.getByTestId("extension-detail-back").click();
  await expect(installedRow.getByTestId("extension-automation-status")).toContainText("3/4");
  await disableAutomationReads.wait();
  await disableAutomationReads.release();

  await installedRow.click();
  const enabledAutomationRow = page
    .getByTestId("extension-automation-row")
    .filter({ hasText: "Refine backlog tickets" });
  const enabledAutomationCheckbox = enabledAutomationRow.locator("input[type='checkbox']");
  const enabledAutomationSwitch = enabledAutomationRow.locator("[data-scope='switch'][data-part='control']");
  await expect(enabledAutomationCheckbox).not.toBeChecked();

  const enableAutomationReads = await holdProjectExtensionReads(page, project.id);
  const enableAutomationResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes("/automations/"),
  );
  await enabledAutomationSwitch.click();
  expect((await enableAutomationResponse).status()).toBe(200);
  await expect(enabledAutomationCheckbox).toBeChecked();
  await page.getByTestId("extension-detail-back").click();
  await expect(installedRow.getByTestId("extension-automation-status")).toContainText("4/4");
  await enableAutomationReads.wait();
  await enableAutomationReads.release();

  await openExtensions(page, project.id);
  const persistedRow = page.getByTestId("extension-entry").filter({ hasText: "Prompt Studio Planner Automation" });
  await expect(persistedRow.locator("input[type='checkbox']")).toBeChecked();
  await expect(persistedRow.getByTestId("extension-automation-status")).toContainText("4/4");
});
