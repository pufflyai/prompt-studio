import { expect, test } from "@playwright/test";
import {
  createPlannerTag,
  createPlannerTicket,
  getPlannerTicketTags,
  listPlannerTickets,
} from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const ticketsRendererStorageKey = (projectId: string) =>
  `pstdio/ui/data-renderer/pstdio:workbench:dataRenderer:pstdio-planner.tickets:pstdio-planner.tickets:project:${projectId}`;

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
  input: { projectId: string; displayProperties: string[]; viewMode?: "board" | "list" },
) => {
  await page.addInitScript(
    ({ projectId, displayProperties, storageKey, viewMode }) => {
      window.localStorage.setItem("dashboard-wb:selected-project:global", projectId);
      window.localStorage.setItem(
        `pstdio-project-settings/projects/${projectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.harness-open-code.opencode",
            lastSelectedModels: [],
            lastSelectedRepo: "",
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            settings: {
              viewMode,
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
    {
      projectId: input.projectId,
      displayProperties: input.displayProperties,
      storageKey: ticketsRendererStorageKey(input.projectId),
      viewMode: input.viewMode ?? "board",
    },
  );
};

const closeFloatingSessionBubble = async (page: import("@playwright/test").Page) => {
  const bubble = page.getByTestId("workbench-session-bubble");
  if (!(await bubble.isVisible().catch(() => false))) return;
  await bubble.getByRole("button", { name: "Minimize panel" }).click();
  await expect(bubble).toHaveCount(0);
};

test("ticket card tag badges update selected values without opening the card", async ({ page, request }) => {
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
  await expect(page.getByRole("menuitemcheckbox", { name: "dashboard", exact: true })).toBeVisible();
  await expect(card).toBeVisible();

  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute") &&
      response.status() === 200,
  );
  await page.getByRole("menuitemcheckbox", { name: "dashboard", exact: true }).click();
  await updateResponse;

  await expect(card).toBeVisible();

  await expect
    .poll(async () => {
      const tickets = await listPlannerTickets(request, apiBase, project.id);
      return tickets.find((candidate) => candidate.id === ticket.id)?.tagIds ?? [];
    })
    .toEqual(expect.arrayContaining([apiOption.id, dashboardOption.id]));
});

test("ticket card single-select tag badges update and clear selected values", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Data renderer default tag dropdowns");
  const tags = await getPlannerTicketTags(request, apiBase, project.id);
  const typeTag = tags.find((tag) => tag.id === "default-type")!;
  const complexityTag = tags.find((tag) => tag.id === "default-complexity")!;
  const bugOption = typeTag.options.find((option) => option.id === "default-type-bug")!;
  const featureOption = typeTag.options.find((option) => option.id === "default-type-feature")!;
  const simpleOption = complexityTag.options.find((option) => option.id === "default-complexity-simple")!;
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "# Default tag dropdown regression",
    tagIds: [bugOption.id, simpleOption.id],
  });

  await selectProjectAndDisplayTicketProperties(page, {
    projectId: project.id,
    displayProperties: ["id", "type", "complexity"],
  });
  await page.goto("/");
  await page.getByRole("option", { name: "Tickets", exact: true }).click();

  const card = page.getByTestId("renderer-card").filter({ hasText: "Default tag dropdown regression" }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole("button", { name: "Bug", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Simple", exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Bug", exact: true }).click();
  const selectFeatureRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute"),
  );
  const selectFeatureResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute") &&
      response.status() === 200,
  );
  await page.getByRole("menuitemradio", { name: "Feature", exact: true }).click();
  await expect(selectFeatureRequest.then((request) => request.postDataJSON().params.value)).resolves.toBe(
    featureOption.id,
  );
  await selectFeatureResponse;

  await expect
    .poll(async () => {
      const tickets = await listPlannerTickets(request, apiBase, project.id);
      return tickets.find((candidate) => candidate.id === ticket.id)?.tagIds ?? [];
    })
    .toEqual(expect.arrayContaining([featureOption.id, simpleOption.id]));

  await expect(card.getByRole("button", { name: "Feature", exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Feature", exact: true }).click();
  const clearFeatureRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute"),
  );
  const clearFeatureResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute") &&
      response.status() === 200,
  );
  await page.getByRole("menuitemradio", { name: "No Type", exact: true }).click();
  await expect(clearFeatureRequest.then((request) => request.postDataJSON().params.value)).resolves.toBe("");
  await clearFeatureResponse;

  await expect
    .poll(async () => {
      const tickets = await listPlannerTickets(request, apiBase, project.id);
      return tickets.find((candidate) => candidate.id === ticket.id)?.tagIds ?? [];
    })
    .toEqual([simpleOption.id]);

  await expect(card.getByRole("button", { name: "Type", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Simple", exact: true })).toBeVisible();
});

test("ticket list tag badges update and clear selected values", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Data renderer list tag dropdowns");
  const tags = await getPlannerTicketTags(request, apiBase, project.id);
  const typeTag = tags.find((tag) => tag.id === "default-type")!;
  const priorityTag = tags.find((tag) => tag.id === "default-priority")!;
  const bugOption = typeTag.options.find((option) => option.id === "default-type-bug")!;
  const featureOption = typeTag.options.find((option) => option.id === "default-type-feature")!;
  const highOption = priorityTag.options.find((option) => option.id === "default-priority-high")!;
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "# List tag dropdown regression",
    tagIds: [bugOption.id, highOption.id],
  });

  await selectProjectAndDisplayTicketProperties(page, {
    projectId: project.id,
    displayProperties: ["id", "type", "priority"],
    viewMode: "list",
  });
  await page.goto("/");
  await page.getByRole("option", { name: "Tickets", exact: true }).click();

  const row = page.getByRole("option").filter({ hasText: "List tag dropdown regression" }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await closeFloatingSessionBubble(page);
  await expect(row.getByRole("button", { name: "Bug", exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "High", exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Bug", exact: true }).click();
  const selectFeatureRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute"),
  );
  const selectFeatureResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute") &&
      response.status() === 200,
  );
  await page.getByRole("menuitemradio", { name: "Feature", exact: true }).click();
  await expect(selectFeatureRequest.then((request) => request.postDataJSON().params.value)).resolves.toBe(
    featureOption.id,
  );
  await selectFeatureResponse;

  await expect(row).toBeVisible();
  await expect(row.getByRole("button", { name: "Feature", exact: true })).toBeVisible();

  await row.getByRole("button", { name: "High", exact: true }).click();
  const clearPriorityRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute"),
  );
  const clearPriorityResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-attribute/execute") &&
      response.status() === 200,
  );
  await page.getByRole("menuitemradio", { name: "No Priority", exact: true }).click();
  await expect(clearPriorityRequest.then((request) => request.postDataJSON().params.value)).resolves.toBe("");
  await clearPriorityResponse;

  await expect
    .poll(async () => {
      const tickets = await listPlannerTickets(request, apiBase, project.id);
      return tickets.find((candidate) => candidate.id === ticket.id)?.tagIds ?? [];
    })
    .toEqual([featureOption.id]);

  await expect(row.getByRole("button", { name: "Feature", exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Priority", exact: true })).toBeVisible();
});
