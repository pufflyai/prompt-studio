import { existsSync, rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";
import { showHiddenSidenavEntry } from "./helpers/sidenav-navigation";

test("ticket work opens a shared non-Git folder and loads files without Git requests", async ({ page, request }) => {
  const home = await (await request.get(`${uiOrigin}/v1/filesystem/list`)).json();
  const directory = await request.post(`${uiOrigin}/v1/filesystem/directories`, {
    data: { parent_path: home.currentPath, name: `shared-ticket-${crypto.randomUUID()}` },
  });
  expect(directory.ok()).toBe(true);
  const { path } = await directory.json();
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({}, path) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const workspaceUrl = `${uiOrigin}/v1/workspaces?project_id=${projectId}`;
    const [workspace] = await (await request.get(workspaceUrl)).json();
    const providers = await (await request.get(`${uiOrigin}/v1/projects/${projectId}/workspace-providers`)).json();
    expect(providers.some((provider: { id: string }) => provider.id === "pstdio.worktree")).toBe(false);
    const file = await request.post(`${uiOrigin}/v1/workspaces/${workspace.id}/file?path=notes.md`, {
      data: { content: "# Shared notes\n\nThese files belong to the selected folder.\n" },
    });
    expect(file.ok()).toBe(true);
    const ticket = await createPlannerTicket(request, uiOrigin, projectId!, { content: "# Plain folder ticket" });
    await page.addInitScript((id) => localStorage.setItem("dashboard-wb2:selected-project:global", id), projectId!);
    const gitRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/v1\/workspaces\/[^/]+\/diff/.test(request.url())) gitRequests.push(request.url());
    });
    await page.goto(`/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`);
    const workspaceNavigation = await showHiddenSidenavEntry(page, "Workspaces");
    await workspaceNavigation.hover();
    await expect(workspaceNavigation.getByRole("button", { name: "New workspace", exact: true })).toHaveCount(0);
    await workspaceNavigation.click();
    await expect(page.getByRole("row").filter({ hasText: workspace.workspace_shorthand })).toBeVisible();
    const providerRoute = `**/v1/projects/${projectId}/workspace-providers`;
    await page.route(providerRoute, (route) => route.fulfill({ status: 503, body: "Provider catalog unavailable" }));
    await page.reload();
    await expect(workspaceNavigation).toBeVisible();
    await workspaceNavigation.hover();
    await expect(workspaceNavigation.getByRole("button", { name: "New workspace", exact: true })).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: workspace.workspace_shorthand })).toBeVisible();
    await page.unroute(providerRoute);
    await page.goto(`/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`);
    await page.getByTestId("renderer-card").getByText("Plain folder ticket", { exact: true }).click();
    await expect(page.getByRole("option", { name: "Project workspace", exact: true })).toBeVisible();
    await page.getByText("Workspaces", { exact: true }).last().hover();
    await expect(page.getByRole("button", { name: "Create workspace", exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: "Project workspace", exact: true }).click();
    await expect(page.getByRole("option", { name: "notes.md", exact: true })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Changes", exact: true })).toHaveCount(0);
    await expect(page.locator('[data-workbench-panel-header="main"]')).not.toBeVisible();
    await page.getByRole("option", { name: "notes.md", exact: true }).click();
    await expect(page.locator(".monaco-editor .view-lines")).toContainText("Shared notes");
    expect(gitRequests).toEqual([]);
    expect(await (await request.get(workspaceUrl)).json()).toEqual([
      expect.objectContaining({ id: workspace.id, root_path: path, is_default: true, anchors_json: [] }),
    ]);
    await executePlannerCommand(request, uiOrigin, projectId!, "archive-ticket", { ticket: ticket.id });
    expect(await (await request.get(workspaceUrl)).json()).toEqual([
      expect.objectContaining({ id: workspace.id, archived: false }),
    ]);
  } finally {
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  }
});
