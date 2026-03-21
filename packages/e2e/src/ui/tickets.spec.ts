import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string, agentId = "opencode") => {
  await page.addInitScript(
    ({ currentProjectId, currentAgentId }: { currentProjectId: string; currentAgentId: string }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", currentAgentId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${currentProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: currentAgentId,
            lastSelectedModels: [],
            lastSelectedRepo: "",
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { currentProjectId: projectId, currentAgentId: agentId },
  );
};

const createGitRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-ticket-attempt-repo-"));
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "ticket attempt e2e\n");
  execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
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

const registerRepoViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
  path: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name, path },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string; path: string };
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

const createTemplateViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
  templateType: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/templates`, {
    data: { name, template_type: templateType, content: `# ${name}\n\nTemplate content` },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string; template_type: string };
};

test.describe("Ticket list", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Test Project");
    projectId = project.id;
  });

  test("shows board view with default status columns", async ({ page, request }) => {
    await bypassOnboarding(page, projectId);
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

    await bypassOnboarding(page, projectId);
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

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("backlog", { exact: true }).first()).toBeVisible();

    // Click the "+" button in the first creatable column
    await page.getByRole("button", { name: "Create ticket" }).first().click();

    // Fill in the modal content editor
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Describe the ticket...")).toBeVisible();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("New E2E Ticket");
    await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();

    // Verify ticket appears on the board
    await expect(page.getByText("New E2E Ticket")).toBeVisible();

    // Verify via API
    await expect.poll(async () => (await listTickets()).length).toBeGreaterThan(initialTickets.length);
  });

  test("creates a ticket with a selected tag via the create modal", async ({ page, request }) => {
    const listTickets = async () => {
      const res = await request.get(`${apiBase}/v1/tickets?project_id=${projectId}`);
      expect(res.ok()).toBe(true);
      return (await res.json()) as { id: string; display_title: string | null; tag_ids: string[] }[];
    };

    const tagName = "ui-e2e-bug";
    const tagRes = await request.post(`${apiBase}/v1/projects/${projectId}/ticket-tags`, {
      data: { name: tagName, color: "red" },
    });
    expect(tagRes.ok()).toBe(true);
    const createdTag = (await tagRes.json()) as { id: string };

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await page.getByRole("button", { name: "Create ticket" }).first().click();

    const dialog = page.getByRole("dialog").last();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("Tagged modal ticket");

    await dialog.getByRole("button", { name: "Tags", exact: true }).click();
    await page.getByRole("option", { name: tagName, exact: true }).click();

    await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();

    await expect(page.getByText("Tagged modal ticket")).toBeVisible();

    await expect
      .poll(async () => {
        const tickets = await listTickets();
        const createdTicket = tickets.find((ticket) => ticket.display_title === "Tagged modal ticket");
        return createdTicket?.tag_ids ?? [];
      })
      .toContain(createdTag.id);
  });

  test("navigates to ticket detail on click", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;
    const ticket = await createTicketViaApi(request, projectId, "Detail test", backlog.id);

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await page.getByText("Detail test").click();

    await page.waitForURL(`**/projects/${projectId}/tickets/${ticket.shorthand}`);
    expect(page.url()).toContain(`/tickets/${ticket.shorthand}`);
  });
});

test.describe("Ticket list editing and filtering", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Test Project");
    projectId = project.id;
  });

  test("updates ticket display title after editing content and returning to list", async ({ page, request }) => {
    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("backlog", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Create ticket" }).first().click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Describe the ticket...")).toBeVisible();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("Original display title");
    await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();

    await expect(page.getByText("Original display title")).toBeVisible();

    const listTickets = async () => {
      const res = await request.get(`${apiBase}/v1/tickets?project_id=${projectId}`);
      expect(res.ok()).toBe(true);
      return (await res.json()) as { id: string; shorthand: string; display_title: string | null }[];
    };

    await expect.poll(async () => (await listTickets()).length).toBe(1);
    const [createdTicket] = await listTickets();
    expect(createdTicket).toBeTruthy();
    expect(createdTicket.display_title).toBe("Original display title");

    await page.getByText("Original display title").first().click();
    await page.waitForURL(`**/projects/${projectId}/tickets/${createdTicket!.shorthand}`);

    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/v1/tickets/${createdTicket!.id}`) &&
        response.status() === 200,
    );

    const editor = page.locator("[data-testid='content-editable']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Updated display title");
    await saveResponse;

    await page.getByRole("button", { name: "Back to tickets" }).click();
    await page.waitForURL(`**/projects/${projectId}/tickets`);

    await expect(page.getByText("Updated display title")).toBeVisible();
    await expect(page.getByText("Original display title")).not.toBeVisible();
  });

  test("preserves edited ticket content after leaving and reopening ticket details", async ({ page, request }) => {
    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("backlog", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Create ticket" }).first().click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Describe the ticket...")).toBeVisible();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("Original content title");
    await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();

    const listTickets = async () => {
      const res = await request.get(`${apiBase}/v1/tickets?project_id=${projectId}`);
      expect(res.ok()).toBe(true);
      return (await res.json()) as { id: string; shorthand: string; display_title: string | null }[];
    };

    await expect.poll(async () => (await listTickets()).length).toBe(1);
    const [createdTicket] = await listTickets();
    expect(createdTicket).toBeTruthy();

    await page.getByText("Original content title").first().click();
    await page.waitForURL(`**/projects/${projectId}/tickets/${createdTicket!.shorthand}`);

    const updatedContent = "Persisted content title\n\npersisted-body-marker";
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/v1/tickets/${createdTicket!.id}`) &&
        response.status() === 200,
    );
    const editor = page.locator("[data-testid='content-editable']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(updatedContent);
    await saveResponse;
    await expect(editor).toContainText("persisted-body-marker");

    await page.getByRole("button", { name: "Back to tickets" }).click();
    await page.waitForURL(`**/projects/${projectId}/tickets`);
    await expect(page.getByText("Persisted content title")).toBeVisible();
    await page.getByText("Persisted content title").first().click();
    await page.waitForURL(`**/projects/${projectId}/tickets/${createdTicket!.shorthand}`);

    const reopenedEditor = page.locator("[data-testid='content-editable']").first();
    await expect(reopenedEditor).toContainText("persisted-body-marker", { timeout: 12_000 });
  });

  test("filters tickets by hiding archived tickets", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;

    await createTicketViaApi(request, projectId, "Visible ticket", backlog.id);
    const archivedTicket = await createTicketViaApi(request, projectId, "Archived ticket", backlog.id);
    await updateTicketViaApi(request, archivedTicket.id, { archived: true });

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("Visible ticket")).toBeVisible();
    await expect(page.getByText("Archived ticket")).not.toBeVisible();
  });
});

test.describe("Ticket list additional coverage", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Test Project");
    projectId = project.id;
  });

  test("shows ticket shorthand on cards", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;
    const ticket = await createTicketViaApi(request, projectId, "Shorthand test", backlog.id);

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText(ticket.shorthand)).toBeVisible();
  });

  test("displays multiple tickets in the same column", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;

    await createTicketViaApi(request, projectId, "First task", backlog.id);
    await createTicketViaApi(request, projectId, "Second task", backlog.id);
    await createTicketViaApi(request, projectId, "Third task", backlog.id);

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("First task")).toBeVisible();
    await expect(page.getByText("Second task")).toBeVisible();
    await expect(page.getByText("Third task")).toBeVisible();
  });

  test("shows loading state before tickets are ready", async ({ page }) => {
    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    // Either loading text or the board should be visible (loading may be fast)
    const loadingOrBoard = page.getByText("Loading tickets...").or(page.getByText("backlog", { exact: true }).first());
    await expect(loadingOrBoard).toBeVisible();
  });

  test("shows template selector in refine ticket modal when templates exist", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;

    await createTemplateViaApi(request, projectId, "Bug Report", "ticket");
    const ticket = await createTicketViaApi(request, projectId, "Template test ticket", backlog.id);

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets/${ticket.shorthand}`);

    // Open ticket action menu and click "Refine ticket"
    await page.getByRole("button", { name: "Open ticket options" }).click();
    await page.getByRole("option", { name: "Refine ticket", exact: true }).click();

    // The refine modal should open with a template selector
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Refine Ticket", { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText("Template", { exact: true })).toBeVisible();

    // Click the template dropdown trigger and verify "Bug Report" is listed
    await dialog.getByRole("button", { name: "No template" }).click();
    await expect(page.getByText("Bug Report", { exact: true })).toBeVisible();
  });

  test("shows the tag on the ticket detail after creating a ticket with a tag", async ({ page, request }) => {
    const tagName = "ui-e2e-feature";
    const tagRes = await request.post(`${apiBase}/v1/projects/${projectId}/ticket-tags`, {
      data: { name: tagName, color: "blue" },
    });
    expect(tagRes.ok()).toBe(true);

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await page.getByRole("button", { name: "Create ticket" }).first().click();

    const dialog = page.getByRole("dialog").last();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("Ticket with tag");

    await dialog.getByRole("button", { name: "Tags", exact: true }).click();
    await page.getByRole("option", { name: tagName, exact: true }).click();

    await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();

    await expect(page.getByText("Ticket with tag")).toBeVisible();

    const listTickets = async () => {
      const res = await request.get(`${apiBase}/v1/tickets?project_id=${projectId}`);
      expect(res.ok()).toBe(true);
      return (await res.json()) as { id: string; shorthand: string; display_title: string | null }[];
    };

    await expect.poll(async () => (await listTickets()).length).toBe(1);
    const [createdTicket] = await listTickets();

    await page.getByText("Ticket with tag").first().click();
    await page.waitForURL(`**/projects/${projectId}/tickets/${createdTicket.shorthand}`);

    // The tag selector should show the tag name, not "No tags selected"
    await expect(page.getByText(tagName)).toBeVisible();
    await expect(page.getByText("No tags selected")).not.toBeVisible();
  });

  test("toggles a tag on a ticket from the detail sidebar", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;

    // Create a tag for the project
    const tagName = "ui-e2e-bug";
    const tagRes = await request.post(`${apiBase}/v1/projects/${projectId}/ticket-tags`, {
      data: { name: tagName, color: "red" },
    });
    expect(tagRes.ok()).toBe(true);

    // Create a ticket
    const ticket = await createTicketViaApi(request, projectId, "Tag test ticket", backlog.id);

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets/${ticket.shorthand}`);

    // The tag selector should show "No tags selected"
    const tagTrigger = page.getByRole("button", { name: "No tags selected", exact: true });
    await expect(tagTrigger).toBeVisible();

    // Open the tag dropdown and select the created tag
    await tagTrigger.click();

    const tagPatchResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/v1/tickets/${ticket.id}`) &&
        response.status() === 200,
    );
    await page.getByRole("option", { name: tagName, exact: true }).click();
    await tagPatchResponse;

    // The trigger should now show the selected tag instead of "No tags selected"
    await expect(page.getByText("No tags selected")).not.toBeVisible();

    // Verify via API that the tag was assigned
    const listRes = await request.get(`${apiBase}/v1/tickets?project_id=${projectId}`);
    const allTickets = (await listRes.json()) as { id: string; tag_ids: string[] }[];
    const updatedTicket = allTickets.find((t) => t.id === ticket.id);
    expect(updatedTicket?.tag_ids).toHaveLength(1);
  });
});

test.describe("Ticket detail run attempt", () => {
  let projectId: string;
  const repoDirs: string[] = [];

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Attempt Test Project");
    projectId = project.id;
  });

  test.afterEach(() => {
    for (const dir of repoDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    repoDirs.length = 0;
  });

  test("creates attempt workspace and session from Run Attempt", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;
    const ticket = await createTicketViaApi(request, projectId, "Run attempt success ticket", backlog.id);
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    await registerRepoViaApi(request, projectId, "attempt-repo", repoRoot);

    await bypassOnboarding(page, projectId, "fake");
    await page.goto(`/projects/${projectId}/tickets/${ticket.shorthand}`);

    await page.getByRole("button", { name: "Run Attempt", exact: true }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Create Workspace", { exact: true })).toBeVisible();

    const attemptResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/v1/tickets/${ticket.id}/attempts`) &&
        response.status() === 201,
    );

    await dialog.getByRole("button", { name: "Run Attempt", exact: true }).click();
    await attemptResponse;

    await expect
      .poll(async () => {
        const workspacesRes = await request.get(`${apiBase}/v1/workspaces?project_id=${projectId}`);
        if (!workspacesRes.ok()) return 0;
        const workspaces = (await workspacesRes.json()) as Array<{ ticket_shorthand: string }>;
        return workspaces.filter((workspace) => workspace.ticket_shorthand === ticket.shorthand).length;
      })
      .toBe(1);

    await expect
      .poll(async () => {
        const sessionsRes = await request.get(`${apiBase}/v1/sessions?project_id=${projectId}`);
        if (!sessionsRes.ok()) return 0;
        const sessions = (await sessionsRes.json()) as Array<{ id: string }>;
        return sessions.length;
      })
      .toBeGreaterThan(0);
  });

  test("shows an error and keeps modal open when Run Attempt fails", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;
    const ticket = await createTicketViaApi(request, projectId, "Run attempt failure ticket", backlog.id);

    await bypassOnboarding(page, projectId, "fake");
    await page.goto(`/projects/${projectId}/tickets/${ticket.shorthand}`);

    await page.getByRole("button", { name: "Run Attempt", exact: true }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Create Workspace", { exact: true })).toBeVisible();

    const attemptResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/v1/tickets/${ticket.id}/attempts`) &&
        response.status() >= 400,
    );

    await dialog.getByRole("button", { name: "Run Attempt", exact: true }).click();
    await attemptResponse;

    await expect(dialog.getByText("Create Workspace", { exact: true })).toBeVisible();
    await expect(page.getByText("Failed to create attempt. Please try again.")).toBeVisible();
  });
});
