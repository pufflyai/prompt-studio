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
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
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

// Critical risk: late settings must not replace the panel the user selected.
test("preserves the Contributions tab selected while extension settings load", async ({ page, request }) => {
  const project = await createProject(request);
  await openExtensions(page, project.id);
  const release = Promise.withResolvers<void>();
  let held = 0;
  await page.route(
    new RegExp(`/v1/projects/${project.id}/extensions/[^/]+/(settings|contributions)$`),
    async (route) => {
      held += 1;
      await release.promise;
      await route.continue();
    },
  );
  await page.getByTestId("extension-entry").filter({ hasText: "Workbench fixture" }).click();
  const contributions = page.getByRole("tab", { name: "Contributions", exact: true });
  try {
    await expect.poll(() => held).toBe(2);
    await contributions.click();
  } finally {
    release.resolve();
  }
  await expect(page.getByRole("tab", { name: "Settings", exact: true })).toBeVisible();
  await expect(contributions).toHaveAttribute("aria-selected", "true");
});

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

// Critical risk: overlapping saves can overwrite an automation preference.
test("keeps all dropdown automation switches disabled while a change is saving", async ({ page, request }) => {
  const project = await createProject(request);
  await openExtensions(page, project.id);
  const installedRow = page.getByTestId("extension-entry").filter({ hasText: "Project Planner" });
  await installedRow.getByTestId("extension-automations-trigger").click();
  const checkboxes = page.getByTestId("extension-automations-popover").filter({ visible: true }).getByRole("checkbox");
  await expect(checkboxes.nth(1)).toBeEnabled();

  const patch = Promise.withResolvers<import("@playwright/test").Route>();
  await page.route("**/automations/**", (route) => patch.resolve(route), { times: 1 });
  const response = page.waitForResponse(
    (entry) => entry.request().method() === "PATCH" && entry.url().includes("/automations/"),
  );
  await checkboxes.first().focus();
  await page.keyboard.press("Space");
  const heldPatch = await patch.promise;
  try {
    await expect(checkboxes.first()).toBeDisabled();
    await expect(checkboxes.nth(1)).toBeDisabled();
  } finally {
    await heldPatch.continue();
  }
  expect((await response).status()).toBe(200);
  await expect(checkboxes.first()).toBeEnabled();
  await expect(checkboxes.nth(1)).toBeEnabled();
});

// Critical risk: automation controls must be reachable without leaving the extension list.
test("turns automations off and on in the extension list dropdown", async ({ page, request }) => {
  const project = await createProject(request);
  await openExtensions(page, project.id);
  const installedRow = page.getByTestId("extension-entry").filter({ hasText: "Workbench fixture" });
  const trigger = installedRow.getByTestId("extension-automations-trigger");
  await trigger.click();
  const popover = page.getByTestId("extension-automations-popover").filter({ visible: true });
  await expect(popover).toBeVisible();
  const checkbox = popover.getByRole("checkbox", { name: "Toggle automation Lab heartbeat" });
  await expect(checkbox).toBeChecked();

  for (const enabled of [false, true]) {
    const reads = await holdProjectExtensionReads(page, project.id);
    const patch = Promise.withResolvers<import("@playwright/test").Route>();
    await page.route("**/automations/**", (route) => patch.resolve(route), { times: 1 });
    const response = page.waitForResponse(
      (entry) => entry.request().method() === "PATCH" && entry.url().includes("/automations/"),
    );
    await checkbox.focus();
    await page.keyboard.press("Space");
    const heldPatch = await patch.promise;
    await expect(checkbox).toBeDisabled();
    await heldPatch.continue();
    expect((await response).status()).toBe(200);
    await expect(checkbox).toBeChecked({ checked: enabled });
    await expect(trigger).toContainText(enabled ? "1/1" : "0/1");
    await expect(popover).toBeVisible();
    await expect(page.getByTestId("extensions-panel")).toBeVisible();
    await reads.wait();
    await reads.release();
  }

  await trigger.click();
  await expect(popover).not.toBeVisible();
  await installedRow.click();
  await expect(page.getByTestId("extension-automation-row").getByRole("checkbox")).toBeChecked();
  await openExtensions(page, project.id);
  await expect(installedRow.getByTestId("extension-automation-status")).toContainText("1/1");
});
