import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";
import { createGitRepo } from "./helpers/workspace-session-attempt";

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, projectId);
};

const createProjectViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  name: string,
  folderPath?: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name }, folderPath),
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const createWorkspaceViaApi = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const res = await request.post(`${apiBase}/v1/workspaces`, {
    data: { project_id: projectId, provider_id: "pstdio.worktree", params: {} },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; workspace_shorthand: string };
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  expect(res.ok()).toBe(true);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    const del = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(del.ok()).toBe(true);
  }
};

test.describe("Session bubble workspace selection", () => {
  let projectId: string;
  const repoDirs: string[] = [];

  test.beforeEach(async ({ request }) => {
    test.setTimeout(15_000);
    await deleteAllProjects(request);
  });

  test.afterEach(() => {
    for (const dir of repoDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    repoDirs.length = 0;
  });

  test("changes the draft workspace without opening the workspace", async ({ page, request }) => {
    const repoRoot = createGitRepo("pstdio-e2e-session-bubble-repo-", "session bubble workspace selection");
    repoDirs.push(repoRoot);
    projectId = (await createProjectViaApi(request, "Session Bubble Workspace Test Project", repoRoot)).id;
    await bypassOnboarding(page, projectId);

    const workspace = await createWorkspaceViaApi(request, projectId);
    const ticket = await createPlannerTicket(request, apiBase, projectId, {
      content: "Choose a session workspace",
    });

    await page.goto(`/projects/${projectId}`);
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    await page.getByText(ticket.content, { exact: true }).click();
    await expect(page).toHaveURL(/\/extensions\/pstdio\.pstdio-planner\/ticket\?resource=/);
    const ticketUrl = page.url();

    const nav = page.locator('[data-workbench-region="nav"]');
    await nav.getByRole("button", { name: "Show Side Panel" }).click();
    await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();
    const sidePanel = page.getByTestId("workbench-side-panel-attached");
    await expect(sidePanel).toBeVisible();

    await sidePanel.getByRole("button", { name: "Select workspace" }).click();
    await page.locator("[data-testid='session-workspace-options']").getByText(workspace.workspace_shorthand).click();

    await expect(page).toHaveURL(ticketUrl);
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).not.toContainText(workspace.workspace_shorthand);
    await expect(sidePanel.getByRole("button", { name: "Select workspace" })).toContainText(
      workspace.workspace_shorthand,
    );
  });
});
