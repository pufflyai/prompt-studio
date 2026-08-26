import { rmSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createProject = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-173 Resource Hierarchy" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ selectedProjectId, selectedRepoId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
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

test("PS-173 navigates ticket ancestry to a linked workspace and back", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  const repoRoot = createGitRepo("pstdio-ps-173-", "resource hierarchy e2e");
  const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-173-repo", repoRoot);

  try {
    const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
    const statusId = (statuses.find((status) => status.isDefault) ?? statuses[0])?.id;
    const root = await createPlannerTicket(request, apiBase, project.id, {
      content: "PS-173 hierarchy root",
      statusId,
    });
    const parent = await createPlannerTicket(request, apiBase, project.id, {
      content: "PS-173 hierarchy parent",
      statusId,
      parentId: root.id,
    });
    const child = await createPlannerTicket(request, apiBase, project.id, {
      content: "PS-173 hierarchy child",
      statusId,
      parentId: parent.id,
    });
    const attempt = await createPlannerAttempt(request, apiBase, project.id, {
      ticketId: child.id,
      repoId: repo.id,
      mode: "worktree",
    });

    await prepareDashboard(page, project.id, repo.id);
    await page.goto(`/projects/${project.id}/`);
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    const rootCard = page.getByTestId("renderer-card").filter({ hasText: root.title }).first();
    await expect(rootCard).toBeVisible({ timeout: 30_000 });
    await rootCard.getByText(root.title, { exact: true }).click();

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await expect(sidenav.getByRole("option", { name: new RegExp(parent.shorthand) })).toBeVisible({
      timeout: 30_000,
    });
    await sidenav.getByRole("option", { name: new RegExp(parent.shorthand) }).click();
    await expect(sidenav.getByRole("option", { name: new RegExp(child.shorthand) })).toBeVisible();
    await sidenav.getByRole("option", { name: new RegExp(child.shorthand) }).click();

    await expect(breadcrumb).toContainText(root.shorthand);
    await expect(breadcrumb).toContainText(parent.shorthand);
    await expect(breadcrumb).toContainText(child.shorthand);
    await expect(sidenav.getByRole("button", { name: "New file" })).toHaveCount(1);
    await expect(sidenav.getByRole("button", { name: "Create workspace" })).toHaveCount(1);

    const workspaceRow = sidenav.getByRole("option", {
      name: new RegExp(attempt.workspace.workspace_shorthand),
    });
    await expect(workspaceRow).toBeVisible();
    await workspaceRow.click();

    await expect(breadcrumb).toContainText(root.shorthand);
    await expect(breadcrumb).toContainText(parent.shorthand);
    await expect(breadcrumb).toContainText(child.shorthand);
    await expect(breadcrumb).toContainText(attempt.workspace.workspace_shorthand);

    await page.getByRole("button", { name: "Navigate back" }).click();
    await expect(breadcrumb).toContainText(child.shorthand);
    await expect(breadcrumb).not.toContainText(attempt.workspace.workspace_shorthand);
    await expect(sidenav.getByRole("button", { name: "New file" })).toHaveCount(1);
    await expect(sidenav.getByRole("button", { name: "Create workspace" })).toHaveCount(1);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
