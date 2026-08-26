import { rmSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import {
  createAttemptWithSessionViaApi,
  createGitRepo,
  createTicketViaApi,
  registerRepoViaApi,
} from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const TICKET_CONTENT = "Session status on the workspace badge";
const TERMINAL_STATUS_PATTERN = /^(completed|failed|cancelled|disconnected)$/;

const deleteAllProjects = async (request: APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) await request.delete(`${apiBase}/v1/projects/${project.id}`);
};

const createProjectViaApi = async (request: APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const bypassOnboarding = async (page: Page, projectId: string) => {
  await page.addInitScript((currentProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", currentProjectId);
  }, projectId);
};

const getSessionStatus = async (request: APIRequestContext, sessionId: string) => {
  const res = await request.get(`${apiBase}/v1/sessions/${sessionId}`);
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { status: string }).status;
};

const setSessionStatus = async (request: APIRequestContext, sessionId: string, status: string) => {
  const res = await request.patch(`${apiBase}/v1/sessions/${sessionId}/status`, { data: { status } });
  expect(res.ok()).toBe(true);
};

test.describe("PS-24 session status on ticket workspace badges", () => {
  const repoDirs: string[] = [];

  test.afterAll(() => {
    for (const dir of repoDirs) rmSync(dir, { recursive: true, force: true });
  });

  test("follows the latest workspace session status and opens it in the Side Panel", async ({ page, request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "PS-24 Session Status");
    const repoRoot = createGitRepo("pstdio-e2e-ps-24-", "session status e2e");
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-24-repo", repoRoot);
    const ticket = await createTicketViaApi(request, apiBase, project.id, TICKET_CONTENT);
    const attempt = await createAttemptWithSessionViaApi(
      request,
      apiBase,
      project.id,
      ticket.id,
      repo.id,
      "Show status",
    );

    // The fake harness exits on its own; settle on its terminal status before driving transitions
    // so the harness cannot overwrite the status the assertions below are waiting for.
    await expect
      .poll(() => getSessionStatus(request, attempt.session.id), { timeout: 30_000 })
      .toMatch(TERMINAL_STATUS_PATTERN);

    await bypassOnboarding(page, project.id);

    // The SPA router can briefly render "Not found" before it hydrates; retry until the
    // project navigation is interactable, then enter the board from it.
    const ticketsNav = page.getByRole("option", { name: "Tickets", exact: true });
    await expect(async () => {
      await page.goto("/");
      await expect(ticketsNav).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await ticketsNav.click();

    const card = page.getByTestId("renderer-card").filter({ hasText: TICKET_CONTENT }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    const indicator = card.getByTestId("workspace-badge").getByLabel("Open latest session");
    await expect(indicator).toBeVisible({ timeout: 15_000 });

    // Scenario 2: a status change arriving over the synced session feed re-renders the board.
    await setSessionStatus(request, attempt.session.id, "awaiting_input");
    await expect(indicator).toHaveClass(/lucide-circle-dot/, { timeout: 15_000 });

    await setSessionStatus(request, attempt.session.id, "failed");
    await expect(indicator).toHaveClass(/lucide-circle-alert/, { timeout: 15_000 });

    // Scenario 3: the indicator opens its session in the Side Panel and leaves the board in place.
    await indicator.click();
    await expect(page.getByRole("dialog", { name: "Side Panel" })).toBeVisible({ timeout: 15_000 });
    await expect(card).toBeVisible();
  });
});
