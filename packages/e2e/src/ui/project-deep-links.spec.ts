import { expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";
import { test } from "./helpers/notification-settings";

test.use({ notificationsEnabled: true });

const createProject = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name }) });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; name: string };
};

test("a link to another project opens that project", async ({ page, request }) => {
  const activeProject = await createProject(request, "Deep Link Active Project");
  const linkedProject = await createProject(request, "Deep Link Linked Project");
  await page.addInitScript((projectId) => {
    window.localStorage.setItem("onboarding-complete", "true");
    window.localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, activeProject.id);

  await page.goto(`/projects/${linkedProject.id}/sessions`);

  const projectCrumb = page
    .locator('[data-workbench-region="nav"]')
    .getByRole("button", { name: new RegExp(`${linkedProject.name}$`) });
  await expect(projectCrumb).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`/projects/${linkedProject.id}/sessions`));
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("dashboard-wb2:selected-project:global")))
    .toBe(linkedProject.id);
});
