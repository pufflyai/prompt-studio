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

  let holdExtensionRefetch = false;
  let heldExtensionRefetch: import("@playwright/test").Route | null = null;
  await page.route(`**/v1/projects/${project.id}/extensions`, async (route) => {
    if (holdExtensionRefetch && !heldExtensionRefetch) {
      heldExtensionRefetch = route;
      return;
    }
    await route.continue();
  });

  await installedRow.click();
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByTestId("extension-delete").click();
  const dialog = page.getByRole("dialog").last();
  await dialog.getByText("Also delete this extension's data", { exact: false }).click();
  holdExtensionRefetch = true;
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

  await expect
    .poll(() => heldExtensionRefetch !== null, { message: "background extension refresh was not requested" })
    .toBe(true);
  await heldExtensionRefetch?.continue();
  await page.unroute(`**/v1/projects/${project.id}/extensions`);

  const installResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/extensions/marketplace/pstdio-planner-loops/install") &&
      response.request().method() === "POST",
  );
  await availableRow.getByTestId("marketplace-extension-install").click();
  expect((await installResponse).status()).toBe(200);
  await expect
    .poll(async () => {
      const response = await request.get(`${apiBase}/v1/projects/${project.id}/extensions`);
      expect(response.ok()).toBe(true);
      const result = (await response.json()) as {
        extensions: Array<{ enabled: boolean; installName: string }>;
      };
      return result.extensions.find((extension) => extension.installName === "pstdio-planner-loops");
    })
    .toMatchObject({ enabled: true });
  await expect(installedRow).toBeVisible();
  expect(existsSync(join(repoPath, ".pstdio/extensions/pstdio-planner-loops/package.json"))).toBe(true);

  const checkbox = installedRow.locator("input[type='checkbox']");
  const visibleSwitch = installedRow.locator("[data-scope='switch'][data-part='control']");
  await expect(checkbox).toBeChecked();

  const disableResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes(`/extensions/`),
  );
  await visibleSwitch.click();
  expect((await disableResponse).status()).toBe(200);
  await expect(checkbox).not.toBeChecked();

  const enableResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes(`/extensions/`),
  );
  await visibleSwitch.click();
  expect((await enableResponse).status()).toBe(200);
  await expect(checkbox).toBeChecked();

  await installedRow.click();
  const automationRow = page.getByTestId("extension-automation-row").filter({ hasText: "Refine backlog tickets" });
  await expect(automationRow).toBeVisible();
  const automationCheckbox = automationRow.locator("input[type='checkbox']");
  const automationSwitch = automationRow.locator("[data-scope='switch'][data-part='control']");
  await expect(automationCheckbox).toBeChecked();

  const heldAutomationRefreshes: import("@playwright/test").Route[] = [];
  await page.route(`**/v1/projects/${project.id}/extensions/**`, async (route) => {
    const requestUrl = route.request().url();
    if (
      route.request().method() === "GET" &&
      (requestUrl.endsWith("/extensions/ui") || requestUrl.endsWith("/contributions"))
    ) {
      heldAutomationRefreshes.push(route);
      return;
    }
    await route.continue();
  });

  const disableAutomationResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes("/automations/"),
  );
  await automationSwitch.click();
  expect((await disableAutomationResponse).status()).toBe(200);
  await expect(automationCheckbox).not.toBeChecked();
  await expect
    .poll(() => heldAutomationRefreshes.length, { message: "background automation refresh was not requested" })
    .toBeGreaterThan(0);

  for (const route of heldAutomationRefreshes) await route.continue();
  await page.unroute(`**/v1/projects/${project.id}/extensions/**`);

  const enableAutomationResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes("/automations/"),
  );
  await automationSwitch.click();
  expect((await enableAutomationResponse).status()).toBe(200);
  await expect(automationCheckbox).toBeChecked();
});
