import { rmSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket } from "../helpers/planner-api";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createProject = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-171 Resource Layout Restore" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ selectedProjectId, selectedRepoId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.extension-lab.fake",
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
  const row = page.getByRole("option").filter({ hasText: shorthand }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole("paragraph").filter({ hasText: shorthand }).click();
};

test("PS-171 restores resource Panel state across A to B to A and reload", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  const repoRoot = createGitRepo("pstdio-ps-171-", "resource layout restore e2e");
  const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-171-repo", repoRoot);

  try {
    const ticketA = await createPlannerTicket(request, apiBase, project.id, {
      content: "PS-171 workspace A",
    });
    const ticketB = await createPlannerTicket(request, apiBase, project.id, {
      content: "PS-171 workspace B",
    });
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

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const workspacesNavigation = sidenav.getByRole("option", { name: /^Workspaces(?:\s|$)/ }).first();
    const navChrome = await page.locator('[data-workbench-region="nav"]').elementHandle();
    expect(navChrome).not.toBeNull();
    await workspacesNavigation.click();

    await openWorkspace(page, attemptA.workspace.workspace_shorthand);
    await expect(page.getByRole("button", { name: "Show Secondary Panel" })).toBeVisible();
    await page.getByRole("button", { name: "Show Secondary Panel" }).click();
    const separator = page.getByRole("separator", {
      name: "Resize Secondary Panel",
    });
    await expect(separator).toBeVisible();
    await separator.press("ArrowUp");
    await separator.press("ArrowUp");
    const workspaceASize = await separator.getAttribute("aria-valuenow");
    expect(workspaceASize).not.toBeNull();

    await workspacesNavigation.click();
    await openWorkspace(page, attemptB.workspace.workspace_shorthand);
    await expect(page.getByRole("button", { name: "Show Secondary Panel" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Secondary Panel" })).not.toBeVisible();

    await workspacesNavigation.click();
    await openWorkspace(page, attemptA.workspace.workspace_shorthand);
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute("aria-valuenow", workspaceASize!);
    expect(await navChrome!.evaluate((element) => element.isConnected)).toBe(true);

    await page.reload();
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute("aria-valuenow", workspaceASize!);
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(
      attemptA.workspace.workspace_shorthand,
    );

    await workspacesNavigation.click();
    await expect(page.getByRole("button", { name: "Show Secondary Panel" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Workspaces");

    const persistedLayoutKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith("dashboard-wb:layout:project/")),
    );
    expect(
      persistedLayoutKeys.some((key) =>
        key.includes(`/resource/dashboard-workbench://workspace/${attemptA.workspace.id}`),
      ),
    ).toBe(true);
    expect(
      persistedLayoutKeys.some((key) =>
        key.includes(`/resource/dashboard-workbench://workspace/${attemptB.workspace.id}`),
      ),
    ).toBe(true);
    expect(persistedLayoutKeys.some((key) => key.endsWith("/aggregate/workspaces"))).toBe(true);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
