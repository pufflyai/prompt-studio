import { rmSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket } from "../helpers/planner-api";
import { showHiddenSidenavEntry } from "./helpers/sidenav-navigation";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createProject = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "Resource layout restore" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ selectedProjectId, selectedRepoId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
      localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.extension-lab.harness.fake",
            lastSelectedModels: [],
            lastSelectedRepo: selectedRepoId,
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId, selectedRepoId: repoId },
  );
};

const openWorkspace = async (page: Page, shorthand: string) => {
  const row = page.getByRole("row").filter({ hasText: shorthand }).first();
  await expect(row).toBeVisible();
  await row.getByRole("cell").filter({ hasText: shorthand }).first().click();
};

test("restores each resource's panel state across navigation and reload", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  const repoRoot = createGitRepo("pstdio-resource-layout-", "resource layout restore e2e");
  const repo = await registerRepoViaApi(request, apiBase, project.id, "resource-layout-repo", repoRoot);

  try {
    const ticketA = await createPlannerTicket(request, apiBase, project.id, { content: "Workspace A" });
    const ticketB = await createPlannerTicket(request, apiBase, project.id, { content: "Workspace B" });
    const attemptA = await createPlannerAttempt(request, apiBase, project.id, {
      ticketId: ticketA.id,
      repoId: repo.id,
      mode: "worktree",
    });
    const attemptB = await createPlannerAttempt(request, apiBase, project.id, {
      ticketId: ticketB.id,
      repoId: repo.id,
      mode: "worktree",
    });

    await prepareDashboard(page, project.id, repo.id);
    await page.goto(`/projects/${project.id}/`);
    const workspacesNavigation = await showHiddenSidenavEntry(page, "Workspaces");
    await workspacesNavigation.click();

    await openWorkspace(page, attemptA.workspace.workspace_shorthand);
    await page.getByRole("button", { name: "Show Secondary Panel" }).click();
    const separator = page.getByRole("separator", { name: "Resize Secondary Panel" });
    await separator.press("ArrowUp");
    await separator.press("ArrowUp");
    const workspaceASize = await separator.getAttribute("aria-valuenow");
    expect(workspaceASize).not.toBeNull();

    await workspacesNavigation.click();
    await openWorkspace(page, attemptB.workspace.workspace_shorthand);
    await expect(page.getByRole("region", { name: "Secondary Panel" })).not.toBeVisible();

    await workspacesNavigation.click();
    await openWorkspace(page, attemptA.workspace.workspace_shorthand);
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute("aria-valuenow", workspaceASize!);

    await page.reload();
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute("aria-valuenow", workspaceASize!);
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(
      attemptA.workspace.workspace_shorthand,
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
