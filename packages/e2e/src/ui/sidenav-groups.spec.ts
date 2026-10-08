import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { verifyTreeGroups } from "../helpers/tree-groups";
import { uiOrigin } from "../ui-server";

test("creates and persists Sidenav groups and returns their rows when removed", async ({ page, request }) => {
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
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const search = sidenav.getByRole("option", { name: "Search", exact: true });
  await expect(search).toBeVisible();
  await verifyTreeGroups(page, sidenav, search);
});
