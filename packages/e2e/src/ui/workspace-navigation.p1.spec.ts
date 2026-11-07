import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";
import { showSidenavEntry } from "./helpers/sidenav-navigation";
import { createGitRepo } from "./helpers/workspace-session-attempt";

// Critical risk: workspace session navigation must keep its session controls and a visible way back to project tools.
test("project files keep project navigation and workspaces open their own session navigation", async ({
  page,
  request,
}) => {
  const repoRoot = createGitRepo("pstdio-workspace-navigation-", "Workspace navigation");
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Workspace navigation" }, repoRoot),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const workspaces = await (await request.get(`${uiOrigin}/v1/workspaces?project_id=${projectId}`)).json();
    const folder = workspaces.find((workspace: { is_default: boolean }) => workspace.is_default);
    const response = await request.post(`${uiOrigin}/v1/workspaces`, {
      data: { project_id: projectId, provider_id: "pstdio.worktree", params: {} },
    });
    expect(response.ok()).toBe(true);
    const workspace = await response.json();
    for (const [id, title] of [
      [folder.id, "Folder session"],
      [workspace.id, "Workspace session"],
    ]) {
      const session = await request.post(`${uiOrigin}/v1/sessions`, {
        data: {
          project_id: projectId,
          workspace_id: id,
          title,
          prompt: title,
          agent: "pstdio.workbench-fixture.harness.fake",
        },
      });
      expect(session.ok()).toBe(true);
    }
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, projectId!);
    await page.goto(`/projects/${projectId}`);
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await (await showSidenavEntry(page, "Files")).click();
    await expect(page).toHaveURL(/\/extensions\/pstdio\.pstdio-workspaces\/files\?/);
    await expect(sidenav.locator('[data-tree-list-node-id="workspace-sessions"]')).toHaveCount(0);
    await (await showSidenavEntry(page, "Workspaces")).click();
    await page
      .getByRole("region", { name: "Main", exact: true })
      .getByRole("option")
      .filter({ hasText: workspace.workspace_shorthand })
      .first()
      .click();
    await expect(page).toHaveURL(/\/extensions\/pstdio\.pstdio-workspaces\/workspace\?/);
    const session = sidenav.getByRole("option", { name: "Workspace session", exact: true });
    await expect(session).toBeVisible();
    await expect(sidenav.getByRole("option", { name: "Folder session", exact: true })).toHaveCount(0);
    await expect(sidenav.getByRole("option", { name: "Workspaces", exact: true })).toHaveCount(0);
    await session.click();
    await expect(page.getByTestId("content-editable").filter({ visible: true }).last()).toBeEditable();
    await sidenav.getByRole("button", { name: "Back to project", exact: true }).click();
    await expect(await showSidenavEntry(page, "Workspaces")).toBeVisible();
    await expect(sidenav.locator('[data-tree-list-node-id="workspace-sessions"]')).toHaveCount(0);
  } finally {
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
