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

const persistHiddenLauncherAsActive = async (page: import("@playwright/test").Page) => {
  await page.waitForTimeout(300);
  const updatedKey = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => {
      if (!candidate.startsWith("dashboard-wb:layout:")) return false;
      return localStorage.getItem(candidate)?.includes('"contributionId":"workbench.terminal"') === true;
    });
    if (!key) return undefined;

    const persisted = JSON.parse(localStorage.getItem(key) ?? "") as {
      layout: {
        activeWidgetId?: string;
        regions: { secondary: { activeWidgetId?: string } };
      };
    };
    persisted.layout.activeWidgetId = "workbench.terminal.launcher";
    persisted.layout.regions.secondary.activeWidgetId = "workbench.terminal.launcher";
    localStorage.setItem(key, JSON.stringify(persisted));
    return key;
  });

  expect(updatedKey).toBeTruthy();
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

test("PS-43 restores the first terminal when the hidden launcher was persisted active", async ({ page, request }) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-43 Restored Terminal" },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };

  try {
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);

    const showSecondary = page.getByRole("button", { name: "Show Secondary Panel" });
    if (await showSecondary.isVisible()) await showSecondary.click();
    await page.locator('[data-workbench-panel-header="secondary"]').getByRole("button", { name: "Add panel" }).click();
    await expect(page.getByRole("textbox", { name: "Terminal input" })).toBeVisible();

    await page.getByRole("button", { name: "Hide Secondary Panel" }).click();
    await persistHiddenLauncherAsActive(page);
    await page.reload();
    await page.getByRole("button", { name: "Show Secondary Panel" }).click();

    const secondaryHeader = page.locator('[data-workbench-panel-header="secondary"]');
    await expect(secondaryHeader.getByRole("tab")).toHaveCount(1);
    await expect(page.locator(".xterm:visible")).toHaveCount(1);
    const terminalInput = page.getByRole("textbox", { name: "Terminal input" });
    await terminalInput.pressSequentially("echo __ps43_restored_terminal__");
    await terminalInput.press("Enter");
    await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__ps43_restored_terminal__");
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
});
