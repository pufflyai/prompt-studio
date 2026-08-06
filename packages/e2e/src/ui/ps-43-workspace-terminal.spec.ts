import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `dashboard-wb:last-resource:${selectedProjectId}`,
      JSON.stringify({
        kind: "dashboard-view",
        uri: "dashboard-workbench://dashboard-view/workspaces",
        id: "workspaces",
        label: "Workspaces",
        icon: "computer",
      }),
    );
  }, projectId);
};

const openWorkspaceTerminal = async (page: import("@playwright/test").Page, workspaceName: string) => {
  const workspaceRow = page.getByRole("option", { name: workspaceName, exact: true });
  await expect(workspaceRow).toBeVisible({ timeout: 30_000 });
  await workspaceRow.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  await expect(page.getByRole("region", { name: "Secondary Panel" })).toBeVisible();
};

const expectTerminalPwd = async (page: import("@playwright/test").Page, expectedPath: string) => {
  const terminalInput = page.getByRole("textbox", { name: "Terminal input" });
  await expect(terminalInput).toBeFocused();
  await terminalInput.pressSequentially("pwd");
  await terminalInput.press("Enter");
  await expect(page.locator(".xterm:visible .xterm-rows")).toContainText(expectedPath);
};

test("PS-43 opens default and worktree terminals in their effective workspace directories", async ({
  page,
  request,
}) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-43 Workspace Terminal" },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  const repoRoot = createGitRepo("pstdio-ps-43-", "workspace terminal e2e");

  try {
    const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-43-repo", repoRoot);
    const workspaceResponse = await request.post(`${apiBase}/v1/workspaces`, {
      data: { project_id: project.id, repo_id: repo.id },
    });
    expect(workspaceResponse.ok()).toBe(true);
    const worktree = (await workspaceResponse.json()) as {
      workspace_shorthand: string;
      worktree_path: string;
    };

    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}/workspaces`);

    await openWorkspaceTerminal(page, "ps-43-repo");
    await expectTerminalPwd(page, repoRoot);

    await openWorkspaceTerminal(page, worktree.workspace_shorthand);
    await expectTerminalPwd(page, worktree.worktree_path);
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
