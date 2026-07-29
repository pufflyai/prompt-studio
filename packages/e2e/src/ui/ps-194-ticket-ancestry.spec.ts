import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createProject = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-194 Ticket Ancestry" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

test("PS-194 shows ticket ancestry and filters by immediate parent", async ({ page, request }) => {
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const statusId = (statuses.find((status) => status.isDefault) ?? statuses[0])?.id;
  const root = await createPlannerTicket(request, apiBase, project.id, {
    content: "PS-194 hierarchy root",
    statusId,
  });
  const child = await createPlannerTicket(request, apiBase, project.id, {
    content: "PS-194 hierarchy child",
    statusId,
    parentId: root.id,
  });
  const grandchild = await createPlannerTicket(request, apiBase, project.id, {
    content: "PS-194 hierarchy grandchild",
    statusId,
    parentId: child.id,
  });

  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/`);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();

  const rootCard = page.getByTestId("renderer-card").filter({ hasText: root.title });
  const childCard = page.getByTestId("renderer-card").filter({ hasText: child.title });
  const grandchildCard = page.getByTestId("renderer-card").filter({ hasText: grandchild.title });
  await expect(rootCard.getByText(root.shorthand, { exact: true })).toBeVisible();
  await expect(childCard.getByText(`${root.shorthand} / ${child.shorthand}`, { exact: true })).toBeVisible();
  await expect(
    grandchildCard.getByText(`${root.shorthand} / ${child.shorthand} / ${grandchild.shorthand}`, { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Display settings" }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  const listEyebrows = page.getByTestId("list-row-eyebrow");
  await expect(listEyebrows.getByText(root.shorthand, { exact: true })).toBeVisible();
  await expect(listEyebrows.getByText(`${root.shorthand} / ${child.shorthand}`, { exact: true })).toBeVisible();
  await expect(
    listEyebrows.getByText(`${root.shorthand} / ${child.shorthand} / ${grandchild.shorthand}`, { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Filter rows" }).click();
  await page.getByTestId("filter-property-column").getByRole("button", { name: "Parent", exact: true }).click();
  const rootParentOption = page.getByRole("checkbox", { name: root.shorthand, exact: true });
  await expect(rootParentOption).toContainText("1");
  await rootParentOption.click();

  await expect(page.getByText(child.title, { exact: true })).toBeVisible();
  await expect(page.getByText(root.title, { exact: true })).not.toBeVisible();
  await expect(page.getByText(grandchild.title, { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "Remove Parent filter" }).click();
  await expect(page.getByText(root.title, { exact: true })).toBeVisible();
  await expect(page.getByText(grandchild.title, { exact: true })).toBeVisible();
});
