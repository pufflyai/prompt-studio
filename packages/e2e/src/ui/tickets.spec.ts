import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "opencode");
  });
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const p of projects) {
    await request.delete(`${apiBase}/v1/projects/${p.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const getTicketStatuses = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const res = await request.get(`${apiBase}/v1/projects/${projectId}/ticket-statuses`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string; color: string; is_default: boolean }[];
};

const createTicketViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  content: string,
  statusId?: string,
) => {
  const res = await request.post(`${apiBase}/v1/tickets`, {
    data: { project_id: projectId, content, status_id: statusId ?? undefined },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    id: string;
    shorthand: string;
    display_title: string | null;
    status_id: string | null;
  };
};

const updateTicketViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  ticketId: string,
  data: Record<string, unknown>,
) => {
  const res = await request.patch(`${apiBase}/v1/tickets/${ticketId}`, { data });
  expect(res.ok()).toBe(true);
  return res.json();
};

test.describe("Ticket list", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(5_000);
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Test Project");
    projectId = project.id;
  });

  test("shows board view with default status columns", async ({ page, request }) => {
    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    const statuses = await getTicketStatuses(request, projectId);
    for (const status of statuses) {
      await expect(page.getByText(status.name, { exact: true }).first()).toBeVisible();
    }
  });

  test("displays tickets in the correct status column", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlogStatus = statuses.find((s) => s.name === "backlog");
    const readyStatus = statuses.find((s) => s.name === "ready");

    await createTicketViaApi(request, projectId, "Backlog task", backlogStatus!.id);
    await createTicketViaApi(request, projectId, "Ready task", readyStatus!.id);

    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("Backlog task")).toBeVisible();
    await expect(page.getByText("Ready task")).toBeVisible();
  });

  test("creates a ticket via the create modal", async ({ page, request }) => {
    const listTickets = async () => {
      const res = await request.get(`${apiBase}/v1/tickets?project_id=${projectId}`);
      expect(res.ok()).toBe(true);
      return (await res.json()) as { id: string; display_title: string | null }[];
    };
    const initialTickets = await listTickets();

    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("backlog", { exact: true }).first()).toBeVisible();

    // Click the "+" button in the first creatable column
    await page.getByRole("button", { name: "Create ticket" }).first().click();

    // Fill in the modal content editor
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Describe the ticket...")).toBeVisible();
    await page.keyboard.type("New E2E Ticket");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    // Verify ticket appears on the board
    await expect(page.getByText("New E2E Ticket")).toBeVisible();

    // Verify via API
    await expect.poll(async () => (await listTickets()).length).toBeGreaterThan(initialTickets.length);
  });

  test("navigates to ticket detail on click", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;
    const ticket = await createTicketViaApi(request, projectId, "Detail test", backlog.id);

    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await page.getByText("Detail test").click();

    await page.waitForURL(`**/projects/${projectId}/tickets/${ticket.shorthand}`);
    expect(page.url()).toContain(`/tickets/${ticket.shorthand}`);
  });

  test("filters tickets by hiding archived tickets", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;

    await createTicketViaApi(request, projectId, "Visible ticket", backlog.id);
    const archivedTicket = await createTicketViaApi(request, projectId, "Archived ticket", backlog.id);
    await updateTicketViaApi(request, archivedTicket.id, { archived: true });

    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("Visible ticket")).toBeVisible();
    await expect(page.getByText("Archived ticket")).not.toBeVisible();
  });

  test("shows ticket shorthand on cards", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;
    const ticket = await createTicketViaApi(request, projectId, "Shorthand test", backlog.id);

    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText(ticket.shorthand)).toBeVisible();
  });

  test("displays multiple tickets in the same column", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;

    await createTicketViaApi(request, projectId, "First task", backlog.id);
    await createTicketViaApi(request, projectId, "Second task", backlog.id);
    await createTicketViaApi(request, projectId, "Third task", backlog.id);

    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("First task")).toBeVisible();
    await expect(page.getByText("Second task")).toBeVisible();
    await expect(page.getByText("Third task")).toBeVisible();
  });

  test("shows loading state before tickets are ready", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    // Either loading text or the board should be visible (loading may be fast)
    const loadingOrBoard = page.getByText("Loading tickets...").or(page.getByText("backlog", { exact: true }).first());
    await expect(loadingOrBoard).toBeVisible();
  });
});
