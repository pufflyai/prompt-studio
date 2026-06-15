import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.harness-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const createWorkspaceViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  repoId: string,
) => {
  const res = await request.post(`${apiBase}/v1/workspaces`, {
    data: { project_id: projectId, repo_id: repoId },
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
    const project = await createProjectViaApi(request, "Session Bubble Workspace Test Project");
    projectId = project.id;
  });

  test.afterEach(() => {
    for (const dir of repoDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    repoDirs.length = 0;
  });

  test("changes the draft workspace without opening the workspace", async ({ page, request }) => {
    await bypassOnboarding(page, projectId);
    const repoRoot = createGitRepo("pstdio-e2e-session-bubble-repo-", "session bubble workspace selection");
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, apiBase, projectId, "session-bubble-repo", repoRoot);
    const workspace = await createWorkspaceViaApi(request, projectId, repo.id);

    await page.goto(`/projects/${projectId}/tickets`);

    const bubble = page.locator("[data-testid='workbench-session-bubble']");
    await expect(bubble).toBeVisible();

    await bubble.getByRole("button", { name: "Select workspace" }).click();
    await page.locator("[data-testid='session-workspace-options']").getByText(workspace.workspace_shorthand).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/tickets$`));
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).not.toContainText(workspace.workspace_shorthand);
    await expect(bubble.getByRole("button", { name: "Select workspace" })).toContainText(workspace.workspace_shorthand);
  });
});
