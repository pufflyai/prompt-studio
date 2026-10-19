import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";

const createProject = async (request: import("@playwright/test").APIRequestContext, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Independent workflow statuses" }, folderPath),
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({
        state: {
          lastSelectedAgent: "pstdio.workbench-fixture.harness.fake",
          lastSelectedModels: [],
          lastSelectedRepo: "",
          lastSelectedBranches: [],
          sessionModalState: "closed",
          selectedSessionId: null,
        },
        version: 0,
      }),
    );
  }, projectId);
};

test("editing Planner statuses updates its board without changing the Lab workflow", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const backlog = statuses.find((status) => status.name === "Backlog");
  expect(backlog).toBeDefined();
  await createPlannerTicket(request, apiBase, project.id, {
    content: "Keep the Planner board visible",
    statusId: backlog!.id,
  });
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  await expect(page.getByTestId("board-column-backlog")).toContainText("Keep the Planner board visible", {
    timeout: 30_000,
  });

  await page.getByRole("option", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog");
  await expect(settings).toBeVisible({ timeout: 30_000 });
  await settings.getByRole("option", { name: "Ticket status", exact: true }).click();
  const ticketStatuses = settings.frameLocator('iframe[title="Ticket status"]');
  await ticketStatuses.getByText("Backlog", { exact: true }).first().click();
  const name = ticketStatuses.getByRole("textbox").first();
  await expect(name).toHaveValue("Backlog");
  await name.fill("Planned");
  await name.press("Enter");

  const save = ticketStatuses.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled({ timeout: 15_000 });

  await settings.getByRole("button", { name: /^Close / }).click();
  await expect(settings).not.toBeVisible();
  await expect(page.getByTestId("board-column-backlog")).toContainText("Planned");
  await page.getByRole("option", { name: "Lab mode", exact: true }).click();
  await page.getByRole("tab", { name: "Workflow status demo", exact: true }).click();
  await expect(page.getByTestId("board-column-idea")).toContainText("Idea", { timeout: 30_000 });

  const concept = page.getByTestId("renderer-card").filter({ hasText: "Shape the concept" });
  const testing = page.getByTestId("board-column-testing");
  await expect(concept).toBeVisible();
  const moveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith(
        "/extensions/commands/pstdio.workbench-fixture.view.workflow.kanban.onAttributeChange/execute",
      ),
  );
  await concept.dragTo(testing);
  expect((await moveResponse).ok()).toBe(true);
  await expect(testing).toContainText("Shape the concept");
  await concept.getByText("Shape the concept", { exact: true }).click();
  const artifact = page.frameLocator('iframe[title="Artifact"]');
  await expect(artifact.getByRole("heading", { name: "Shape the concept" })).toBeVisible({ timeout: 15_000 });

  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  await expect(page.getByTestId("board-column-backlog")).toContainText("Keep the Planner board visible", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("board-column-backlog")).toContainText("Planned");
});

test("state commands in the status editor control the matching column", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const backlog = statuses.find((status) => status.name === "Backlog");
  const done = statuses.find((status) => status.name === "Done");
  expect(backlog).toBeDefined();
  expect(done).toBeDefined();
  await createPlannerTicket(request, apiBase, project.id, {
    content: "Keep the backlog column visible",
    statusId: backlog!.id,
  });
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  const backlogColumn = page.getByTestId(`board-column-${backlog!.id}`);
  const doneColumn = page.getByTestId(`board-column-${done!.id}`);
  await expect(backlogColumn).toContainText("Keep the backlog column visible", { timeout: 30_000 });
  await expect(backlogColumn.getByRole("button", { name: "Create row" })).toBeVisible();
  await expect(doneColumn.getByRole("button", { name: "Column actions for Done" })).toBeVisible();
  await doneColumn.getByRole("button", { name: "Column actions for Done" }).click();
  await expect(page.getByRole("menuitem", { name: "Archive all", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("option", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog");
  await expect(settings).toBeVisible({ timeout: 30_000 });
  await settings.getByRole("option", { name: "Ticket status", exact: true }).click();

  const ticketStatuses = settings.frameLocator('iframe[title="Ticket status"]');
  const backlogCommands = ticketStatuses.getByRole("button", { name: "Commands for Backlog" });
  await expect(backlogCommands).toHaveText(/Create/, { timeout: 30_000 });
  await expect(ticketStatuses.getByRole("button", { name: "Commands for Done" })).toHaveText(/Archive all/);
  await expect(ticketStatuses.getByRole("button", { name: "Default value" })).toHaveText(/Backlog/);

  await backlogCommands.click();
  await ticketStatuses.getByRole("menuitem", { name: "Create", exact: true }).click();
  await backlogCommands.press("Escape");
  await expect(backlogCommands).toHaveText(/None/);

  const save = ticketStatuses.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled({ timeout: 15_000 });

  await settings.getByRole("button", { name: /^Close / }).click();
  await expect(settings).not.toBeVisible();
  await page.reload();
  await expect(backlogColumn).toContainText("Keep the backlog column visible", { timeout: 30_000 });
  await expect(backlogColumn.getByRole("button", { name: "Create row" })).toHaveCount(0);
  await expect(doneColumn.getByRole("button", { name: "Column actions for Done" })).toBeVisible();

  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await settings.getByRole("option", { name: "Ticket status", exact: true }).click();
  await expect(ticketStatuses.getByRole("button", { name: "Commands for Backlog" })).toHaveText(/None/, {
    timeout: 30_000,
  });
});
