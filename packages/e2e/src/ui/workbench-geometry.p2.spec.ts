import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  const projects = (await response.json()) as { id: string }[];

  for (const project of projects) {
    const deleteResponse = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(deleteResponse.ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-166 Geometry" }, folderPath),
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    if (window.parent !== window) return;
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/projects/${projectId}/tickets`);
};

test("reopens the Main right menu from a single-resource page", async ({ page, request }) => {
  test.setTimeout(30_000);
  await deleteAllProjects(request);
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const backlog = statuses.find((status) => status.name.toLowerCase() === "backlog");
  expect(backlog).toBeDefined();
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Reopen ticket details",
    statusId: backlog!.id,
  });
  await prepareDashboard(page, project.id);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByText("Reopen ticket details", { exact: true }).click();
  const ticketLink = page.getByRole("link", { name: `${ticket.shorthand} Reopen ticket details` });
  await expect(ticketLink).toBeVisible();

  const mainPanelHeader = page.locator('[data-workbench-panel-header="main"]');
  const rightMenu = page.locator('[data-workbench-panel-menu="main-right"]');
  const opener = mainPanelHeader.getByRole("button", { name: "Open Main right menu" });
  await expect(rightMenu).toBeVisible();
  await expect(opener).toHaveCount(0);

  await page.getByRole("separator", { name: "Resize Main right menu" }).press("Home");
  await expect(rightMenu).toBeHidden();
  await opener.click();

  await expect(rightMenu).toBeVisible();
  await expect(page.getByRole("menu", { name: "Main right menu controls" })).toHaveCount(0);
  await expect(opener).toHaveCount(0);
  await expect(ticketLink).toBeVisible();
});
