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

test("installs and toggles the default repo-scoped Planner Automations extension", async ({ page, request }) => {
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

  const listResponse = await request.get(`${apiBase}/v1/projects/${project.id}/extensions`);
  expect(listResponse.ok()).toBe(true);
  const list = (await listResponse.json()) as {
    extensions: Array<{ enabled: boolean; id: string; installName: string }>;
  };
  const installed = list.extensions.find((extension) => extension.installName === "pstdio-planner-loops");
  expect(installed).toMatchObject({ enabled: true });
  expect(existsSync(join(repoPath, ".pstdio/extensions/pstdio-planner-loops/package.json"))).toBe(true);

  const deleted = await request.delete(`${apiBase}/v1/projects/${project.id}/extensions/${installed!.id}`, {
    params: { deleteUserData: "true" },
  });
  expect(deleted.status()).toBe(204);

  await openExtensions(page, project.id);
  const installedRow = page.getByTestId("extension-entry").filter({ hasText: "Prompt Studio Planner Automation" });
  await expect(installedRow).toHaveCount(0);

  const availableRow = page
    .getByTestId("marketplace-extension-entry")
    .filter({ hasText: "Prompt Studio Planner Automation" });
  await expect(availableRow).toBeVisible();
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
});
