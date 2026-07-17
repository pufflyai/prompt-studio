import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createAttemptWithSessionViaApi,
  createGitRepo,
  createTicketViaApi,
  registerRepoViaApi,
} from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  const projects = (await response.json()) as { id: string }[];

  for (const project of projects) {
    const deleted = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(deleted.ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Resource hierarchy test project" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

test.describe("Resource hierarchy sidebar", () => {
  let repoRoot = "";

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test.afterEach(() => {
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  test("shows each ticket workspace and workspace session once", async ({ page, request }) => {
    test.slow();
    const project = await createProject(request);
    repoRoot = createGitRepo("pstdio-e2e-resource-hierarchy-", "resource hierarchy e2e");
    const repo = await registerRepoViaApi(request, apiBase, project.id, "resource-hierarchy-repo", repoRoot);
    const ticket = await createTicketViaApi(request, apiBase, project.id, "# Resource hierarchy proof");
    const attempt = await createAttemptWithSessionViaApi(
      request,
      apiBase,
      project.id,
      ticket.id,
      repo.id,
      "resource hierarchy proof",
    );

    await bypassOnboarding(page, project.id);
    await page.goto("/");

    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    await page.getByRole("option", { name: `${ticket.shorthand} Resource hierarchy proof`, exact: true }).click();
    const sidebar = page.getByRole("region", { name: "left", exact: true });
    const workspaceRow = page.getByRole("option", { name: attempt.workspace.workspace_shorthand });
    await expect(workspaceRow).toHaveCount(1);
    await workspaceRow.click();

    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(
      attempt.workspace.workspace_shorthand,
    );
    const sessionsGroup = sidebar.getByRole("option", { name: "Sessions", exact: true });
    await expect(sessionsGroup).toHaveCount(1);
    await sessionsGroup.click();
    const sessionRow = page.getByRole("option", { name: `Implement ticket: ${ticket.shorthand}`, exact: true });
    await expect(sessionRow).toHaveCount(1);
  });
});
