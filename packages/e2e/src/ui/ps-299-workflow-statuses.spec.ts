import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Independent workflow statuses" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({
        state: {
          lastSelectedAgent: "pstdio.extension-lab.harness.fake",
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

test("editing one status set updates only its Kanban board", async ({ page, request }) => {
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
  let plannerStatusQueries = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/pstdio.pstdio-planner.status.ticket-statuses.status.query/execute")) {
      plannerStatusQueries += 1;
    }
  });

  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  await expect(page.getByTestId("board-column-backlog")).toContainText("Keep the Planner board visible", {
    timeout: 30_000,
  });

  await page.getByRole("option", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog");
  await expect(settings).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () =>
      (await settings.getByText(/^(Workbench|Project|Lab|Planner)$/).allTextContents()).map((text) => text.trim()),
    )
    .toEqual(["Workbench", "Project", "Lab", "Planner"]);
  const settingsEntries = await settings.getByRole("option").allTextContents();
  const entryIndex = (label: string) => settingsEntries.findIndex((entry) => entry.trim() === label);
  expect(entryIndex("Extensions")).toBeLessThan(entryIndex("Repositories"));
  expect(entryIndex("Repositories")).toBeLessThan(entryIndex("Statuses"));
  expect(entryIndex("Statuses")).toBeLessThan(entryIndex("Danger zone"));
  expect(entryIndex("Danger zone")).toBeLessThan(entryIndex("Lab (global)"));
  expect(entryIndex("Lab (project)")).toBeLessThan(entryIndex("Ticket tags"));
  expect(plannerStatusQueries).toBe(1);
  await settings.getByText("Statuses", { exact: true }).click();
  await expect(settings.getByText("Ticket status", { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(plannerStatusQueries).toBe(1);
  const labStatuses = settings.getByTestId("workflow-status-set-pstdio.extension-lab.status.workflow");
  await expect(labStatuses.getByText("Lab workflow", { exact: true })).toBeVisible({ timeout: 30_000 });

  // The default-value control under the list also reads "Idea", so target the row.
  await labStatuses.getByText("Idea", { exact: true }).first().click();
  const ideaInput = labStatuses.locator("input").first();
  await expect(ideaInput).toHaveValue("Idea");
  await ideaInput.fill("Concept");
  await ideaInput.press("Enter");

  const save = labStatuses.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled({ timeout: 15_000 });

  await page.keyboard.press("Escape");
  await expect(settings).not.toBeVisible();
  await page.getByRole("option", { name: "Lab mode", exact: true }).click();
  await page.getByRole("tab", { name: "Workflow status demo", exact: true }).click();
  await expect(page.getByTestId("board-column-idea")).toContainText("Concept", { timeout: 30_000 });

  const concept = page.getByTestId("renderer-card").filter({ hasText: "Shape the concept" });
  const testing = page.getByTestId("board-column-testing");
  await expect(concept).toBeVisible();
  const moveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith(
        "/extensions/commands/pstdio.extension-lab.view.workflow.kanban.onAttributeChange/execute",
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
  await expect(page.getByTestId("board-column-backlog")).not.toContainText("Concept");
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
  await settings.getByText("Statuses", { exact: true }).click();

  const ticketStatuses = settings.getByTestId("workflow-status-set-pstdio.pstdio-planner.status.ticket-statuses");
  const backlogCommands = ticketStatuses.getByRole("button", { name: "Commands for Backlog" });
  await expect(backlogCommands).toHaveText(/Create/, { timeout: 30_000 });
  await expect(ticketStatuses.getByRole("button", { name: "Commands for Done" })).toHaveText(/Archive all/);
  await expect(ticketStatuses.getByRole("button", { name: "Default value" })).toHaveText(/Backlog/);

  await backlogCommands.click();
  await page.getByRole("menuitem", { name: "Create", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(backlogCommands).toHaveText(/None/);

  const save = ticketStatuses.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled({ timeout: 15_000 });

  await page.keyboard.press("Escape");
  await expect(settings).not.toBeVisible();
  await page.reload();
  await expect(backlogColumn).toContainText("Keep the backlog column visible", { timeout: 30_000 });
  await expect(backlogColumn.getByRole("button", { name: "Create row" })).toHaveCount(0);
  await expect(doneColumn.getByRole("button", { name: "Column actions for Done" })).toBeVisible();

  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await settings.getByText("Statuses", { exact: true }).click();
  await expect(
    settings
      .getByTestId("workflow-status-set-pstdio.pstdio-planner.status.ticket-statuses")
      .getByRole("button", { name: "Commands for Backlog" }),
  ).toHaveText(/None/, { timeout: 30_000 });
});
