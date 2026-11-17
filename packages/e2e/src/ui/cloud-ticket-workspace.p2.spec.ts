import { existsSync, rmSync } from "node:fs";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { expect, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";
import { enableCloudWorkspaceProvider } from "./helpers/cloud-workspace-provider";
import { showSidenavEntry } from "./helpers/sidenav-navigation";

test("a plain-folder ticket creates a linked cloud workspace through its provider form", async ({ page, request }) => {
  const home = await (await request.get(`${uiOrigin}/v1/filesystem/list`)).json();
  const directory = await request.post(`${uiOrigin}/v1/filesystem/directories`, {
    data: { parent_path: home.currentPath, name: `cloud-ticket-${crypto.randomUUID()}` },
  });
  expect(directory.ok()).toBe(true);
  const { path } = await directory.json();
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({}, path) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const workspacesUrl = `${uiOrigin}/v1/workspaces?project_id=${projectId}`;
    const [homeWorkspace] = await (await request.get(workspacesUrl)).json();
    await page.addInitScript((id) => localStorage.setItem("dashboard-wb2:selected-project:global", id), projectId!);
    await page.goto(`/projects/${projectId}`);
    const workspaceNavigation = await showSidenavEntry(page, "Workspaces");
    await workspaceNavigation.hover();
    await expect(workspaceNavigation.getByRole("button", { name: "New workspace", exact: true })).toHaveCount(0);
    const providerId = await enableCloudWorkspaceProvider({
      request,
      apiBase: uiOrigin,
      projectId: projectId!,
      workspaceId: homeWorkspace.id,
      rootPath: path,
    });
    const providers = await (await request.get(`${uiOrigin}/v1/projects/${projectId}/workspace-providers`)).json();
    expect(providers).toEqual([expect.objectContaining({ id: providerId })]);
    // Creation reads providers installed after the initial project page was opened.
    const ticket = await createPlannerTicket(request, uiOrigin, projectId!, { content: "# Cloud workspace ticket" });
    const gitRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/v1\/workspaces\/[^/]+\/diff/.test(request.url())) gitRequests.push(request.url());
    });
    await page.goto(`/projects/${projectId}/extensions/pstdio.planner/tickets`);
    await page.getByTestId("renderer-card").getByText("Cloud workspace ticket", { exact: true }).click();
    await expect(page.getByRole("option", { name: "Project folder", exact: true })).toBeVisible();
    await page.getByText("Workspaces", { exact: true }).last().hover();
    await page.getByRole("button", { name: "Create workspace", exact: true }).click();
    const dialog = page.frameLocator('iframe[title="Workspace action"]');
    await expect(dialog.getByText("Test cloud workspace", { exact: true })).toBeVisible();
    const params = { source: "blank-documents", provider_id: "eu-small" };
    await dialog.getByRole("textbox", { name: "Source template" }).fill(params.source);
    await dialog.getByRole("textbox", { name: "Environment profile" }).fill(params.provider_id);
    await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
    await expect.poll(async () => (await (await request.get(workspacesUrl)).json()).length).toBe(2);
    const workspace = (await (await request.get(workspacesUrl)).json()).find(
      (row: { id: string }) => row.id !== homeWorkspace.id,
    );
    const anchors = [
      {
        type: "ticket",
        id: ticket.id,
        shorthand: ticket.shorthand,
        label: `${ticket.shorthand} ${ticket.title}`,
        metadata: { resourceParent: { type: "view", viewId: "pstdio.planner.view.tickets" } },
        projectId,
        extensionId: "pstdio.planner",
        role: "primary",
      },
    ];
    expect(workspace).toMatchObject({
      root_path: null,
      branch: null,
      execution_kind: "remote",
      provider_state: "ready",
      provider_id: providerId,
      provider_params_json: params,
      anchors_json: anchors,
      workspace_shorthand: `${ticket.shorthand}_A1`,
      provider_capabilities_json: { files: "none", diff: false },
    });
    expect(workspace.provider_ref_json).toEqual({ version: 1, data: { environment: workspace.id, params } });
    await expect(page.locator('iframe[title="Workspace action"]')).toBeHidden();
    await (await showSidenavEntry(page, "Workspaces")).click();
    await expect(
      page
        .getByRole("region", { name: "Main", exact: true })
        .getByRole("option")
        .filter({ hasText: workspace.workspace_shorthand }),
    ).toBeVisible();
    expect(await (await request.get(workspacesUrl)).json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: workspace.id, root_path: null, anchors_json: anchors }),
        expect.objectContaining({ id: homeWorkspace.id, root_path: path, is_default: true }),
      ]),
    );
    expect(gitRequests).toEqual([]);
  } finally {
    if (projectId) expect((await request.delete(`${uiOrigin}/v1/projects/${projectId}`)).ok()).toBe(true);
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  }
});
