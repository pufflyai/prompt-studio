import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createTreeGroup, verifyTreeGroups } from "../helpers/tree-groups";
import { uiOrigin } from "../ui-server";
import { showSidenavEntry } from "./helpers/sidenav-navigation";

test.beforeEach(async ({ page, request }) => {
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Sidenav groups" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/workspaces`);
});

test("creates and persists Sidenav groups and returns their rows when removed", async ({ page }) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const search = sidenav.getByRole("option", { name: "Search", exact: true });
  await expect(search).toBeVisible();
  await verifyTreeGroups(page, sidenav, search);
});

test("shows custom groups only at the navigation level where they were created", async ({ page }) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const search = sidenav.getByRole("option", { name: "Search", exact: true });
  const rootGroup = await createTreeGroup(page, sidenav, search, "Project shortcuts");

  await (await showSidenavEntry(page, "Notes")).click();
  const back = sidenav.getByRole("button", { name: "Back to project", exact: true });
  await expect(back).toBeVisible();
  await expect(search).toBeVisible();
  await expect(rootGroup).toHaveCount(0);
  const subnavGroup = await createTreeGroup(page, sidenav, search, "Notes shortcuts");

  await back.click();
  await expect(rootGroup).toBeVisible();
  await expect(subnavGroup).toHaveCount(0);

  await (await showSidenavEntry(page, "Notes")).click();
  await expect(subnavGroup).toBeVisible();
  await expect(rootGroup).toHaveCount(0);
});
