import { expect, test } from "@playwright/test";
import { createPlannerTag, createPlannerTicket, listPlannerTickets } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const ticketsRendererStorageKey =
  "pstdio/ui/data-renderer/pstdio:workbench:dataRenderer:pstdio-planner.tickets:pstdio-planner.tickets";

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const selectProjectAndDisplayTicketProperties = async (
  page: import("@playwright/test").Page,
  input: { projectId: string; displayProperties: string[] },
) => {
  await page.addInitScript(
    ({ projectId, displayProperties, storageKey }) => {
      window.localStorage.setItem("dashboard-wb:selected-project:global", projectId);
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            settings: {
              viewMode: "board",
              columnGrouping: "status",
              rowGrouping: "none",
              ordering: { attributeId: "updated", direction: "desc" },
              displayProperties,
            },
            filters: {},
            expandedGroups: {},
          },
          version: 2,
        }),
      );
    },
    { projectId: input.projectId, displayProperties: input.displayProperties, storageKey: ticketsRendererStorageKey },
  );
};

test("ticket card tag badges open a dropdown and update selected values", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Data renderer card tag dropdowns");
  const tag = await createPlannerTag(request, apiBase, project.id, {
    name: "surface",
    type: "multi_select",
    options: [
      { name: "api", color: "blue" },
      { name: "dashboard", color: "purple" },
    ],
  });
  const apiOption = tag.options.find((option) => option.name === "api")!;
  const dashboardOption = tag.options.find((option) => option.name === "dashboard")!;
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "# Card tag dropdown regression",
    tagIds: [apiOption.id],
  });

  await selectProjectAndDisplayTicketProperties(page, {
    projectId: project.id,
    displayProperties: ["id", tag.id],
  });
  await page.goto("/");
  await page.getByRole("option", { name: "Tickets", exact: true }).click();

  const card = page.getByTestId("renderer-card").filter({ hasText: "Card tag dropdown regression" }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  const surfaceBadge = card.getByRole("button", { name: "api", exact: true });
  await expect(surfaceBadge).toBeVisible();

  await surfaceBadge.click();
  await expect(page.getByRole("option", { name: "dashboard", exact: true })).toBeVisible();

  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute") &&
      response.status() === 200,
  );
  await page.getByRole("option", { name: "dashboard", exact: true }).click();
  await updateResponse;

  await expect
    .poll(async () => {
      const tickets = await listPlannerTickets(request, apiBase, project.id);
      return tickets.find((candidate) => candidate.id === ticket.id)?.tagIds ?? [];
    })
    .toEqual(expect.arrayContaining([apiOption.id, dashboardOption.id]));
});
