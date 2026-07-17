import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  archivePlannerTicket,
  createPlannerAttempt,
  createPlannerTag,
  createPlannerTicket,
  getPlannerTicketStatuses,
  listPlannerTickets,
} from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const QUESTION_PROMPT_TRIGGER = "__fake_question_prompt__";

const openTicketsListFromDetail = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "Tickets" }).click();
};

const bypassOnboarding = async (
  page: import("@playwright/test").Page,
  projectId: string,
  agentId = "pstdio.harness-open-code.opencode",
) => {
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

const createAttemptViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  ticketId: string,
  repoId: string,
) => {
  return createPlannerAttempt(request, apiBase, projectId, {
    ticketId,
    repoId,
    mode: "worktree",
    startSession: false,
  });
};

const getTicketStatuses = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  return getPlannerTicketStatuses(request, apiBase, projectId);
};

const createTicketViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  content: string,
  statusId?: string,
) => {
  return createPlannerTicket(request, apiBase, projectId, { content, statusId });
};

const createSessionViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  prompt: string,
) => {
  const res = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      title: prompt,
      prompt,
      agent: "pstdio.extension-lab.fake",
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const updateTicketViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  ticketId: string,
  data: Record<string, unknown>,
) => {
  if (data.archived === true) {
    return archivePlannerTicket(request, apiBase, projectId, ticketId);
  }

  throw new Error("Unsupported planner ticket update in E2E fixture.");
};

// A failed POST leaves the modal open with the typed text still visible, so later UI
// assertions can false-pass while the API poll hangs. Waiting on the response surfaces
// the real status and guarantees the server has committed before we query; waiting on
// the dialog to close disambiguates text assertions that would otherwise match both the
// editor (still in the DOM) and the newly-rendered board card.
const submitCreateTicketModal = async (
  page: import("@playwright/test").Page,
  dialog: import("@playwright/test").Locator,
) => {
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.create-ticket/execute"),
  );
  await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();
  const response = await createResponse;
  expect(response.ok()).toBe(true);
  await expect(dialog).not.toBeVisible();
};

const openCreateTicketModal = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "Create ticket", exact: true }).first().click();
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
    const listTickets = () => listPlannerTickets(request, apiBase, projectId);
    const initialTickets = await listTickets();

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("backlog", { exact: true }).first()).toBeVisible();

    await openCreateTicketModal(page);

    // Fill in the modal content editor
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Describe the ticket...")).toBeVisible();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("New E2E Ticket");
    await submitCreateTicketModal(page, dialog);

    // Verify ticket appears on the board
    await expect(page.getByText("New E2E Ticket")).toBeVisible();

    // Verify via API
    await expect.poll(async () => (await listTickets()).length).toBeGreaterThan(initialTickets.length);
  });

  test("creates a ticket with a selected tag via the create modal", async ({ page, request }) => {
    const listTickets = () => listPlannerTickets(request, apiBase, projectId);

    const tagName = "ui-e2e-label";
    const optionName = "ui-e2e-bug";
    const createdTag = await createPlannerTag(request, apiBase, projectId, {
      name: tagName,
      type: "single_select",
      options: [{ name: optionName, color: "red" }],
    });
    const optionId = createdTag.options[0].id;

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await openCreateTicketModal(page);

    const dialog = page.getByRole("dialog").last();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("Tagged modal ticket");

    await dialog.getByRole("button", { name: tagName, exact: true }).click();
    await page.getByRole("menuitem", { name: optionName, exact: true }).click();

    await submitCreateTicketModal(page, dialog);

    await expect(page.getByText("Tagged modal ticket")).toBeVisible();

    await expect
      .poll(async () => {
        const tickets = await listTickets();
        const createdTicket = tickets.find((ticket) => ticket.title === "Tagged modal ticket");
        return createdTicket?.tagIds ?? [];
      })
      .toContain(optionId);
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

    await openCreateTicketModal(page);
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Describe the ticket...")).toBeVisible();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("Original display title");
    await submitCreateTicketModal(page, dialog);

    await expect(page.getByText("Original display title")).toBeVisible();

    const listTickets = () => listPlannerTickets(request, apiBase, projectId);

    await expect.poll(async () => (await listTickets()).length).toBe(1);
    const [createdTicket] = await listTickets();
    expect(createdTicket).toBeTruthy();
    expect(createdTicket.title).toBe("Original display title");

    await page.getByText("Original display title").first().click();
    await page.waitForURL(`**/projects/${projectId}/tickets/${createdTicket!.shorthand}`);

    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.update-ticket/execute") &&
        response.status() === 200,
    );

    const editor = page.locator("[data-testid='content-editable']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Updated display title");
    await saveResponse;

    await openTicketsListFromDetail(page);
    await page.waitForURL(`**/projects/${projectId}/tickets`);

    await expect(page.getByText("Updated display title")).toBeVisible();
    await expect(page.getByText("Original display title")).not.toBeVisible();
  });

  test("preserves edited ticket content after leaving and reopening ticket details", async ({ page, request }) => {
    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("backlog", { exact: true }).first()).toBeVisible();

    await openCreateTicketModal(page);
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Describe the ticket...")).toBeVisible();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("Original content title");
    await submitCreateTicketModal(page, dialog);

    const listTickets = () => listPlannerTickets(request, apiBase, projectId);

    await expect.poll(async () => (await listTickets()).length).toBe(1);
    const [createdTicket] = await listTickets();
    expect(createdTicket).toBeTruthy();

    await page.getByText("Original content title").first().click();
    await page.waitForURL(`**/projects/${projectId}/tickets/${createdTicket!.shorthand}`);

    const updatedContent = "Persisted content title\n\npersisted-body-marker";
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.update-ticket/execute") &&
        response.status() === 200,
    );
    const editor = page.locator("[data-testid='content-editable']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(updatedContent);
    await saveResponse;
    await expect(editor).toContainText("persisted-body-marker");

    await openTicketsListFromDetail(page);
    await page.waitForURL(`**/projects/${projectId}/tickets`);
    const persistedTicketCard = page.getByText("Persisted content title");
    await expect(persistedTicketCard).toBeVisible();
    await persistedTicketCard.click();
    await page.waitForURL(`**/projects/${projectId}/tickets/${createdTicket!.shorthand}`);

    const reopenedEditor = page.locator("[data-testid='content-editable']").first();
    await expect(reopenedEditor).toContainText("persisted-body-marker", { timeout: 12_000 });
  });

  test("filters tickets by hiding archived tickets", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;

    await createTicketViaApi(request, projectId, "Visible ticket", backlog.id);
    const archivedTicket = await createTicketViaApi(request, projectId, "Archived ticket", backlog.id);
    await updateTicketViaApi(request, projectId, archivedTicket.id, { archived: true });

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("Visible ticket")).toBeVisible();
    await expect(page.getByText("Archived ticket")).not.toBeVisible();
  });
});

test.describe("Ticket list additional coverage", () => {
  let projectId: string;
  const repoDirs: string[] = [];

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Test Project");
    projectId = project.id;
  });

  test.afterEach(() => {
    for (const dir of repoDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    repoDirs.length = 0;
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

  test("resumes conversation after selecting a question answer", async ({ page, request }) => {
    await bypassOnboarding(page, projectId, "fake");
    const prompt = `Question follow-up test ${QUESTION_PROMPT_TRIGGER}`;
    const session = await createSessionViaApi(request, projectId, prompt);
    await page.waitForTimeout(200);

    await page.goto(`/projects/${projectId}/sessions/${session.id}`);

    const answerOption = page.getByText("TypeScript", { exact: true });
    const sendButton = page.locator("[data-testid='send-message-button']");

    await expect(page.getByText("Which language do you want to use?").first()).toBeVisible();
    await expect(sendButton).toBeDisabled();

    await answerOption.click();
    await expect(sendButton).toBeEnabled();

    const followUpRequestPromise = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith(`/v1/sessions/${session.id}/follow-up`),
    );
    await sendButton.click();
    const followUpRequest = await followUpRequestPromise;
    expect(followUpRequest.postDataJSON()).toMatchObject({
      prompt: "Which language do you want to use?: TypeScript",
    });

    await expect(page.getByText("Which language do you want to use?: TypeScript").first()).toBeVisible();
    await expect(
      page.getByText('Fake Agent: follow-up "Which language do you want to use?: TypeScript"').first(),
    ).toBeVisible();
  });

  test("shows the tag on the ticket detail after creating a ticket with a tag", async ({ page, request }) => {
    const optionName = "ui-e2e-feature";
    await createPlannerTag(request, apiBase, projectId, {
      name: "type",
      type: "single_select",
      options: [{ name: optionName, color: "blue" }],
    });

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await openCreateTicketModal(page);

    const dialog = page.getByRole("dialog").last();
    const contentEditor = dialog.getByRole("textbox").first();
    await contentEditor.click();
    await contentEditor.fill("Ticket with tag");

    await dialog.getByRole("button", { name: "type", exact: true }).click();
    await page.getByRole("menuitem", { name: optionName, exact: true }).click();

    await submitCreateTicketModal(page, dialog);

    await expect(page.getByText("Ticket with tag")).toBeVisible();

    const listTickets = () => listPlannerTickets(request, apiBase, projectId);

    await expect.poll(async () => (await listTickets()).length).toBe(1);
    const [createdTicket] = await listTickets();

    await page.getByText("Ticket with tag").first().click();
    await page.waitForURL(`**/projects/${projectId}/tickets/${createdTicket.shorthand}`);

    // The tag selector should show the option name, not "No tags selected"
    await expect(page.getByText(optionName)).toBeVisible();
    await expect(page.getByText("No tags selected")).not.toBeVisible();
  });

  test("toggles a tag on a ticket from the detail sidebar", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;

    // Create a tag definition with an option for the project
    const optionName = "ui-e2e-bug";
    await createPlannerTag(request, apiBase, projectId, {
      name: "severity",
      type: "single_select",
      options: [{ name: optionName, color: "red" }],
    });

    // Create a ticket
    const ticket = await createTicketViaApi(request, projectId, "Tag test ticket", backlog.id);

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets/${ticket.shorthand}`);

    // The tag selector should show the tag name as the default label
    const tagTrigger = page.getByRole("button", { name: "severity", exact: true });
    await expect(tagTrigger).toBeVisible();

    // Open the tag dropdown and select the created option
    await tagTrigger.click();

    const tagPatchResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.set-ticket-tags/execute") &&
        response.status() === 200,
    );
    await page.getByRole("menuitem", { name: optionName, exact: true }).click();
    await tagPatchResponse;

    // Verify via API that the tag was assigned
    const allTickets = await listPlannerTickets(request, apiBase, projectId);
    const updatedTicket = allTickets.find((t) => t.id === ticket.id);
    expect(updatedTicket?.tagIds).toHaveLength(1);
  });

  test("shows diffs and hover affordance on workspace badge", async ({ page, request }) => {
    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((s) => s.name === "backlog")!;
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, projectId, "badge-repo", repoRoot);
    const ticket = await createTicketViaApi(request, projectId, "Workspace badge regression", backlog.id);
    const attempt = await createAttemptViaApi(request, projectId, ticket.id, repo.id);

    writeFileSync(join(attempt.workspace.worktree_path, "feature.ts"), 'export const badge = "ready";\n');

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByText("Workspace badge regression")).toBeVisible({ timeout: 15_000 });

    const workspaceBadge = page.getByTestId("workspace-badge").first();
    await expect(workspaceBadge).toBeVisible();
    await expect.poll(() => workspaceBadge.textContent()).toMatch(/\+\d+/);
    await expect.poll(() => workspaceBadge.textContent()).toMatch(/-\d+/);

    await expect.poll(() => workspaceBadge.evaluate((node) => getComputedStyle(node).cursor)).toBe("pointer");
  });
});
