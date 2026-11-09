import { rmSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerAttempt, createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";
import { createGitRepo } from "./helpers/workspace-session-attempt";

const createProject = async (request: APIRequestContext, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-173 Resource Hierarchy" }, folderPath),
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript(
    ({ selectedProjectId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
      localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.workbench-fixture.harness.fake",
            lastSelectedModels: [],
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId },
  );
};

test("navigates ticket ancestry to a linked workspace and back", async ({ page, request }) => {
  test.slow();
  const repoRoot = createGitRepo("pstdio-ps-173-", "resource hierarchy e2e");
  let projectId: string | undefined;
  const failures: unknown[] = [];
  try {
    const project = await createProject(request, repoRoot);
    projectId = project.id;
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
    });

    await prepareDashboard(page, project.id);
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
    await expect(sidenav.getByRole("button", { name: "New file", includeHidden: true })).toHaveCount(1);
    await expect(sidenav.getByRole("button", { name: "Create workspace", includeHidden: true })).toHaveCount(1);

    const workspaceRow = sidenav.getByRole("option", {
      name: new RegExp(attempt.workspace.workspace_shorthand),
    });
    await expect(workspaceRow).toBeVisible();
    await workspaceRow.click();

    await expect(breadcrumb).toContainText(root.shorthand);
    await expect(breadcrumb).toContainText(parent.shorthand);
    await expect(breadcrumb).toContainText(child.shorthand);
    await expect(breadcrumb).toContainText(attempt.workspace.workspace_shorthand);

    // Opening a file keeps the workspace under its ticket instead of the Workspaces list.
    await page.getByRole("tab", { name: "Files" }).click();
    await page.getByRole("option", { name: /^README\.md/ }).click();
    await expect(page.getByText("resource hierarchy e2e")).toBeVisible();
    await expect(breadcrumb).toContainText(child.shorthand);
    await expect(breadcrumb).toContainText(attempt.workspace.workspace_shorthand);
    await expect(breadcrumb).not.toContainText("Workspaces");

    await page.getByRole("button", { name: "Navigate back" }).click();
    await expect(page).not.toHaveURL(/document=/);
    await expect(breadcrumb).toContainText(attempt.workspace.workspace_shorthand);
    await page.getByRole("button", { name: "Navigate back" }).click();
    await expect(breadcrumb).toContainText(child.shorthand);
    await expect(breadcrumb).not.toContainText(attempt.workspace.workspace_shorthand);
    await expect(sidenav.getByRole("button", { name: "New file", includeHidden: true })).toHaveCount(1);
    await expect(sidenav.getByRole("button", { name: "Create workspace", includeHidden: true })).toHaveCount(1);
  } catch (error) {
    failures.push(error);
  }
  try {
    await page.close();
  } catch (error) {
    failures.push(error);
  }
  try {
    if (projectId) {
      const deleted = await request.delete(`/v1/projects/${projectId}`);
      expect(deleted.ok(), await deleted.text()).toBe(true);
    }
    // Failed owner release must retain the checkout instead of racing active writers.
    rmSync(repoRoot, { recursive: true, force: true });
  } catch (error) {
    failures.push(new Error(`Could not release hierarchy fixture at ${repoRoot}`, { cause: error }));
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, `Hierarchy fixture failures: ${failures.map(String).join("; ")}`);
});
