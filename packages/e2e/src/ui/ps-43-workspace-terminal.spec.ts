import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

const openWorkspaceTerminal = async (page: import("@playwright/test").Page, workspaceName: string) => {
  const workspaceRow = page.getByRole("row").filter({ hasText: workspaceName }).first();
  await expect(workspaceRow).toBeVisible({ timeout: 30_000 });
  await workspaceRow.getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  await expect(page.getByRole("region", { name: "Secondary Panel" })).toBeVisible();
};

const openWorkspace = async (page: import("@playwright/test").Page, workspaceName: string) => {
  const workspaceRow = page.getByRole("row").filter({ hasText: workspaceName }).first();
  await expect(workspaceRow).toBeVisible({ timeout: 30_000 });
  await workspaceRow.click();
  await expect(page.getByRole("link", { name: workspaceName, exact: true })).toBeVisible();
};

const showSecondaryPanel = async (page: import("@playwright/test").Page) => {
  const showSecondary = page.getByRole("button", { name: "Show Secondary Panel" });
  if (await showSecondary.isVisible()) await showSecondary.click();
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
  const updatedKeys = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((candidate) => {
      if (!candidate.startsWith("dashboard-wb:layout:")) return false;
      return localStorage.getItem(candidate)?.includes('"contributionId":"workbench.terminal"') === true;
    });

    for (const key of keys) {
      const persisted = JSON.parse(localStorage.getItem(key) ?? "") as {
        layout: {
          activeWidgetId?: string;
          regions: { secondary: { activeWidgetId?: string } };
        };
      };
      persisted.layout.activeWidgetId = "workbench.terminal.launcher";
      persisted.layout.regions.secondary.activeWidgetId = "workbench.terminal.launcher";
      localStorage.setItem(key, JSON.stringify(persisted));
    }
    return keys;
  });

  expect(updatedKeys.length).toBeGreaterThan(0);
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
    await expect(page.getByText("Recent sessions", { exact: true })).toBeVisible();
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

test("PS-296 keeps a workspace terminal in its worktree and alive when the workspace is reopened", async ({
  page,
  request,
}) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-296 Workspace Terminal Return" },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  const repoRoot = createGitRepo("pstdio-ps-296-terminal-", "workspace terminal return e2e");

  try {
    const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-296-terminal-repo", repoRoot);
    const workspaceResponse = await request.post(`${apiBase}/v1/workspaces`, {
      data: { project_id: project.id, repo_id: repo.id },
    });
    expect(workspaceResponse.ok()).toBe(true);
    const workspace = (await workspaceResponse.json()) as {
      workspace_shorthand: string;
      worktree_path: string;
    };

    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}/workspaces`);
    await openWorkspace(page, workspace.workspace_shorthand);
    await showSecondaryPanel(page);
    await page.locator(".xterm:visible").click();
    await expectTerminalPwd(page, workspace.worktree_path);

    const terminalInput = page.getByRole("textbox", { name: "Terminal input" });
    await terminalInput.pressSequentially(
      "export PSTDIO_TERMINAL_RETURN_STATE=kept; printf '__ps296_set__%s__\\n' \"$PSTDIO_TERMINAL_RETURN_STATE\"",
    );
    await terminalInput.press("Enter");
    await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__ps296_set__kept__");

    await page.getByRole("button", { name: "Navigate back" }).click();
    await expect(page.getByRole("row").filter({ hasText: workspace.workspace_shorthand }).first()).toBeVisible();
    await openWorkspace(page, workspace.workspace_shorthand);
    await showSecondaryPanel(page);
    await page.locator(".xterm:visible").click();
    await terminalInput.pressSequentially("printf '__ps296_state__%s__\\n' \"$PSTDIO_TERMINAL_RETURN_STATE\"");
    await terminalInput.press("Enter");

    await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__ps296_state__kept__");
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
