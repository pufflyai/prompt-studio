import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";

test("the project crumb leaves a Sidenav level for the last root-level page", async ({ page, request }) => {
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Level exit" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await createPlannerTicket(request, uiOrigin, project.id, { content: "Level exit ticket" });
  const sessionResponse = await request.post(`${uiOrigin}/v1/sessions`, {
    data: {
      project_id: project.id,
      title: "Exit session",
      prompt: "Exit session",
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  expect(sessionResponse.ok()).toBe(true);
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
  }, project.id);
  await page.goto(`/projects/${project.id}`);

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const row = (name: string) => sidenav.getByRole("option", { name, exact: true });
  const projectCrumb = page
    .locator('[data-workbench-region="nav"]')
    .getByRole("button", { name: new RegExp(`${project.name}$`) });

  await row("Tickets").click();
  await expect(page).toHaveURL(/\/tickets$/);

  await row("Sessions").click();
  await expect(row("Tickets")).toHaveCount(0);
  await row("Exit session").click();
  await expect(page).toHaveURL(/\/session\?/);

  // The breadcrumb leads with the project crumb, which returns to the board the user came from.
  await projectCrumb.click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(row("Sessions")).toBeVisible();

  // The saved board survives a reload that opens a level page straight from the URL.
  await row("Sessions").click();
  await expect(page).toHaveURL(/\/sessions$/);
  await page.reload();
  await expect(row("Exit session")).toBeVisible();
  await projectCrumb.click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(row("Sessions")).toBeVisible();
});
