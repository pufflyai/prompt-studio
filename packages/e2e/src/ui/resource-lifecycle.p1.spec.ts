import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import {
  createPlannerTicket,
  executePlannerCommand,
  getPlannerTicketStatuses,
  listPlannerTickets,
} from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";

const createProject = async (request: import("@playwright/test").APIRequestContext, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-299 Resource Lifecycle" }, folderPath),
  });
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
  await expect(page.locator("[data-workbench-breadcrumb-resource-actions]")).toHaveAccessibleName("Page actions");
  expect(new URL(page.url()).pathname).toBe(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  await expect(page.getByText("Delete open resource", { exact: true }).filter({ visible: true })).toHaveCount(0);
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
    await page.route("**/text-editing/request", async (route) => {
      if (route.request().postDataJSON()?.request?.operation === "submit") {
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
    expect(await (await saveResponse).json()).toMatchObject({
      ok: false,
      error: { code: expect.stringMatching(/^source_(retired|unavailable)$/) },
    });
    held.length = 0;
    expect((await listPlannerTickets(request, apiBase, project.id)).map((item) => item.id)).not.toContain(ticket.id);
    await expect(editor).toContainText("Keep this unsaved draft.");
    await page.getByRole("navigation", { name: "breadcrumb" }).getByText("Tickets", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Create row", exact: true })).toBeVisible();
    await expect(editor).not.toBeVisible();
  } finally {
    await Promise.all(held.map((route) => route.abort().catch(() => undefined)));
    await otherContext.close();
  }
});

test("a removed note's pending draft stays recoverable until its tab is explicitly closed", async ({
  page,
  request,
}) => {
  const project = await createProject(request);
  await waitForPlanner(request, project.id);
  const noteCommand = async (command: string, params: Record<string, string>) => {
    const response = await request.post(
      `${apiBase}/v1/projects/${project.id}/extensions/commands/pstdio.pstdio-notes.command.notes.${command}/execute`,
      { data: { params, source: "api" } },
    );
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.outcome.status).toBe("success");
    return body.outcome.value as { id: string; title: string };
  };
  const note = await noteCommand("create", { title: "Recover before closing" });
  await prepareDashboard(page, project.id);
  await page.goto(`${apiBase}/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  await page.getByRole("option", { name: "Notes", exact: true }).click();
  await page.getByRole("option", { name: note.title, exact: true }).click();
  const tabId = await page
    .getByRole("tab", { name: note.title, exact: true })
    .locator("..")
    .getAttribute("data-workbench-tab");
  expect(tabId).toBeTruthy();
  const tab = page.locator(`[data-workbench-tab="${tabId}"]`);
  const editor = page.getByTestId("content-editable").filter({ visible: true }).first();
  await expect(editor).toBeVisible();
  const held: import("@playwright/test").Route[] = [];
  await page.route("**/text-editing/request", async (route) => {
    if (route.request().postDataJSON()?.request?.operation === "submit") {
      held.push(route);
      return;
    }
    await route.continue();
  });
  try {
    await editor.fill("Recover this removed note.");
    await expect.poll(() => held.length).toBe(1);
    await noteCommand("delete", { noteId: note.id });
    await expect(page.getByText("This resource was removed.", { exact: false })).toBeVisible();
    const saveResponse = page.waitForResponse((response) => response.request() === held[0].request());
    await held[0].continue();
    const refused = await (await saveResponse).json();
    expect(refused.ok).toBe(false);
    held.length = 0;
    await expect(editor).toContainText("Recover this removed note.");
    await expect(tab).toBeVisible();
    await tab.getByRole("button", { name: /^Close/ }).click();
    await expect(tab).toHaveCount(0);
    await expect(page.getByTestId("content-editable")).toHaveCount(0);
  } finally {
    await Promise.all(held.map((route) => route.abort().catch(() => undefined)));
  }
});
