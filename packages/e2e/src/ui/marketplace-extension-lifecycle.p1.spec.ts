import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
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
  let holding = true;
  const handleRoute = async (route: import("@playwright/test").Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const shouldHold =
      request.method() === "GET" &&
      (pathname === `/v1/projects/${projectId}/extensions` ||
        pathname.endsWith("/extensions/ui") ||
        pathname.endsWith("/contributions"));
    if (holding && shouldHold) {
      held.push(route);
      return;
    }
    await route.continue();
  };
  await page.route(pattern, handleRoute);

  return {
    wait: () =>
      expect
        .poll(() => held.length, { message: "background extension reconciliation was not requested" })
        .toBeGreaterThan(0),
    release: async () => {
      holding = false;
      await Promise.all(held.splice(0).map((route) => route.continue()));
      await page.unroute(pattern, handleRoute);
    },
  };
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: `Marketplace extension ${Date.now()}` }, createRepo()),
  });
  expect(projectResponse.ok()).toBe(true);
  return (await projectResponse.json()) as { id: string };
};

test("disables and enables an extension automation", async ({ page, request }) => {
  const project = await createProject(request);
  await openExtensions(page, project.id);
  const installedRow = page.getByTestId("extension-entry").filter({ hasText: "Workbench fixture" });

  await installedRow.click();
  const automationRow = page.getByTestId("extension-automation-row").filter({ hasText: "Lab heartbeat" });
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
  await expect(installedRow.getByTestId("extension-automation-status")).toContainText("0/1");
  await disableAutomationReads.wait();
  await disableAutomationReads.release();

  await installedRow.click();
  const enabledAutomationRow = page.getByTestId("extension-automation-row").filter({ hasText: "Lab heartbeat" });
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
  await expect(installedRow.getByTestId("extension-automation-status")).toContainText("1/1");
  await enableAutomationReads.wait();
  await enableAutomationReads.release();

  await openExtensions(page, project.id);
  await expect(installedRow.getByTestId("extension-automation-status")).toContainText("1/1");
});
