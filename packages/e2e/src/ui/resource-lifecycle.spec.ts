import { expect, test } from "@playwright/test";
import {
  createPlannerTicket,
  executePlannerCommand,
  getPlannerTicketStatuses,
  listPlannerTickets,
} from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-299 Resource Lifecycle" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const waitForPlanner = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
        if (!response.ok()) return false;
        const metadata = (await response.json()) as { views?: Array<{ id: string }> };
        return metadata.views?.some((view) => view.id === "pstdio.pstdio-planner.view.tickets") ?? false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, projectId);
};

test("returns to a resource's parent after deleting the open resource", async ({ page, request }) => {
  const project = await createProject(request);
  await waitForPlanner(request, project.id);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const statusId = (statuses.find((status) => status.isDefault) ?? statuses[0])?.id;
  expect(statusId).toBeTruthy();
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Delete open resource",
    statusId,
  });

  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  const ticketCard = page.getByTestId("renderer-card").filter({ hasText: "Delete open resource" }).first();
  await expect(ticketCard).toBeVisible();
  await ticketCard.getByText("Delete open resource", { exact: true }).click();
  await expect(page.getByTestId("content-editable").first()).toContainText("Delete open resource");

  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith(
        "/extensions/commands/pstdio.pstdio-planner.command.delete-ticket/execute",
      ),
  );
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  expect((await deleteResponse).ok()).toBe(true);

  await expect(page.getByRole("button", { name: "Create row", exact: true })).toBeVisible();
  await expect(page.locator("[data-workbench-breadcrumb-resource-actions]")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  await expect(page.getByText("Delete open resource", { exact: true })).toHaveCount(0);
  await expect
    .poll(async () => (await listPlannerTickets(request, apiBase, project.id)).map((item) => item.id))
    .not.toContain(ticket.id);
});

test("remote deletion closes a clean dashboard while keeping another dashboard's pending draft", async ({
  page,
  browser,
  request,
}) => {
  const project = await createProject(request);
  await waitForPlanner(request, project.id);
  const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "Shared resource draft" });
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  const held: import("@playwright/test").Route[] = [];
  try {
    for (const dashboard of [page, other]) {
      await prepareDashboard(dashboard, project.id);
      await dashboard.goto(`${apiBase}/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
      await dashboard.getByTestId("renderer-card").filter({ hasText: ticket.title }).first().click();
      await expect(dashboard.getByTestId("content-editable").first()).toContainText(ticket.title);
    }
    await page.route("**/extensions/commands/*/execute", async (route) => {
      if (typeof route.request().postDataJSON()?.params?.content === "string") {
        held.push(route);
        return;
      }
      await route.continue();
    });
    const editor = page.getByTestId("content-editable").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText(" Keep this unsaved draft.");
    await expect.poll(() => held.length).toBe(1);
    await executePlannerCommand(request, apiBase, project.id, "delete-ticket", { id: ticket.id });
    await expect(other.getByRole("button", { name: "Create row", exact: true })).toBeVisible();
    await expect(editor).toContainText("Keep this unsaved draft.");
    await expect(page.getByText("This resource was removed.", { exact: false })).toBeVisible();
    const saveResponse = page.waitForResponse((response) => response.request() === held[0].request());
    await held[0].continue();
    await saveResponse;
    held.length = 0;
    expect((await listPlannerTickets(request, apiBase, project.id)).map((item) => item.id)).not.toContain(ticket.id);
    await expect(editor).toContainText("Keep this unsaved draft.");
  } finally {
    await Promise.all(held.map((route) => route.abort().catch(() => undefined)));
    await otherContext.close();
  }
});
