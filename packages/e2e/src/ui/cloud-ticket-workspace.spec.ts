import { existsSync, rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";
import { enableCloudWorkspaceProvider } from "./helpers/cloud-workspace-provider";
import { showHiddenSidenavEntry } from "./helpers/sidenav-navigation";

test("a plain-folder ticket creates a linked cloud workspace through its provider form", async ({ page, request }) => {
  const home = await (await request.get(`${uiOrigin}/v1/filesystem/list`)).json();
  const directory = await request.post(`${uiOrigin}/v1/filesystem/directories`, {
    data: { parent_path: home.currentPath, name: `cloud-ticket-${crypto.randomUUID()}` },
  });
  expect(directory.ok()).toBe(true);
  const { path } = await directory.json();
  let projectId: string | undefined;
  const staleCatalog = Promise.withResolvers<void>();
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({}, path) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const workspacesUrl = `${uiOrigin}/v1/workspaces?project_id=${projectId}`;
    const [homeWorkspace] = await (await request.get(workspacesUrl)).json();
    await page.addInitScript((id) => localStorage.setItem("dashboard-wb2:selected-project:global", id), projectId!);
    await page.goto(`/projects/${projectId}`);
    const workspaceNavigation = await showHiddenSidenavEntry(page, "Workspaces");
    await workspaceNavigation.hover();
    await expect(workspaceNavigation.getByRole("button", { name: "New workspace", exact: true })).toHaveCount(0);
    const catalogCaptured = Promise.withResolvers<void>();
    let heldCatalog = false;
    await page.route(`**/v1/projects/${projectId}/workspace-providers`, async (route) => {
      if (heldCatalog) return route.continue();
      heldCatalog = true;
      const response = await route.fetch();
      expect(await response.json()).toEqual([]);
      catalogCaptured.resolve();
      await staleCatalog.promise;
      await route.fulfill({ response });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await catalogCaptured.promise;
    const providerId = await enableCloudWorkspaceProvider({
      request,
      apiBase: uiOrigin,
      projectId: projectId!,
      workspaceId: homeWorkspace.id,
      rootPath: path,
    });
    const providers = await (await request.get(`${uiOrigin}/v1/projects/${projectId}/workspace-providers`)).json();
    expect(providers).toEqual([expect.objectContaining({ id: providerId })]);
    await workspaceNavigation.hover();
    await workspaceNavigation.getByRole("button", { name: "New workspace", exact: true }).click();
    staleCatalog.resolve();
    const providerDialog = page.getByRole("dialog", { name: "Create workspace", exact: true });
    await expect(providerDialog.getByRole("textbox", { name: "Source template" })).toBeVisible();
    await providerDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const ticket = await createPlannerTicket(request, uiOrigin, projectId!, { content: "# Cloud workspace ticket" });
    const gitRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/v1\/workspaces\/[^/]+\/diff/.test(request.url())) gitRequests.push(request.url());
    });
    await page.goto(`/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`);
    await page.getByTestId("renderer-card").getByText("Cloud workspace ticket", { exact: true }).click();
    await expect(page.getByRole("option", { name: "Project workspace", exact: true })).toBeVisible();
    await page.getByText("Workspaces", { exact: true }).last().hover();
    await page.getByRole("button", { name: "Create workspace", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create workspace", exact: true });
    await expect(dialog.getByText("Test cloud workspace", { exact: true })).toBeVisible();
    const params = { source: "blank-documents", provider_id: "eu-small" };
    await dialog.getByRole("textbox", { name: "Source template" }).fill(params.source);
    await dialog.getByRole("textbox", { name: "Environment profile" }).fill(params.provider_id);
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/v1/workspaces" && response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(202);
    const anchors = [
      {
        type: "ticket",
        id: ticket.id,
        shorthand: ticket.shorthand,
        label: `${ticket.shorthand} ${ticket.title}`,
        metadata: { resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" } },
        projectId,
        extensionId: "pstdio.pstdio-planner",
        role: "primary",
      },
    ];
    expect(response.request().postDataJSON()).toEqual({
      project_id: projectId,
      provider_id: providerId,
      params,
      anchors,
      shorthand_base: ticket.shorthand,
    });
    const workspace = await response.json();
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
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("option", { name: workspace.workspace_shorthand, exact: true })).toBeVisible();
    expect(await (await request.get(workspacesUrl)).json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: workspace.id, root_path: null, anchors_json: anchors }),
        expect.objectContaining({ id: homeWorkspace.id, root_path: path, is_default: true }),
      ]),
    );
    expect(gitRequests).toEqual([]);
  } finally {
    staleCatalog.resolve();
    if (projectId) expect((await request.delete(`${uiOrigin}/v1/projects/${projectId}`)).ok()).toBe(true);
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  }
});
