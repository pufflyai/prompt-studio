import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses, listPlannerTickets } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

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
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

test("PS-299 returns to a resource's parent after deleting the open resource", async ({ page, request }) => {
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
  await page.goto(`/projects/${project.id}/tickets`);
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
  expect(new URL(page.url()).pathname).toBe(`/projects/${project.id}/tickets`);
  await expect(page.getByText("Delete open resource", { exact: true })).toHaveCount(0);
  await expect
    .poll(async () => (await listPlannerTickets(request, apiBase, project.id)).map((item) => item.id))
    .not.toContain(ticket.id);
});
