import { existsSync, rmSync } from "node:fs";
import { defaultPageResourceCodec } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, createPlannerTicketFile } from "../helpers/planner-api";
import { observeTreeRows } from "../helpers/tree-continuity";
import { expect, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";
import { enableCloudWorkspaceProvider } from "./helpers/cloud-workspace-provider";

test("workspace navigation owns selection while keeping ticket document context", async ({ page, request }) => {
  const home = await (await request.get(`${uiOrigin}/v1/filesystem/list`)).json();
  const directory = await request.post(`${uiOrigin}/v1/filesystem/directories`, {
    data: { parent_path: home.currentPath, name: `workspace-selection-${crypto.randomUUID()}` },
  });
  expect(directory.ok()).toBe(true);
  const { path } = await directory.json();
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({}, path) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const [root] = await (await request.get(`${uiOrigin}/v1/workspaces?project_id=${projectId}`)).json();
    const provider = await enableCloudWorkspaceProvider({
      request,
      apiBase: uiOrigin,
      projectId: projectId!,
      workspaceId: root.id,
      rootPath: path,
    });
    const ticket = await createPlannerTicket(request, uiOrigin, projectId!, { content: "# Workspace selection" });
    await createPlannerTicketFile(request, uiOrigin, projectId!, ticket.id, { name: "plan.md", content: "# Plan" });
    const linked = await request.post(`${uiOrigin}/v1/workspaces`, {
      data: {
        project_id: projectId,
        provider_id: provider,
        shorthand_base: ticket.shorthand,
        params: { source: "template", provider_id: "profile" },
        anchors: [
          {
            type: "ticket",
            id: ticket.id,
            shorthand: ticket.shorthand,
            extensionId: "pstdio.planner",
            projectId,
            role: "primary",
          },
        ],
      },
    });
    expect(linked.ok(), await linked.text()).toBe(true);
    const linkedWorkspace = await linked.json();
    const session = await request.post(`${uiOrigin}/v1/sessions`, {
      data: {
        project_id: projectId,
        workspace_id: root.id,
        title: "Workspace conversation",
        prompt: "Workspace conversation",
        agent: "pstdio.workbench-fixture.harness.fake",
        anchors: [{ type: "ticket", id: ticket.id, extensionId: "pstdio.planner", projectId }],
      },
    });
    expect(session.ok(), await session.text()).toBe(true);
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, projectId!);
    const board = `/projects/${projectId}/extensions/pstdio.planner/tickets`;
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const body = sidenav.getByRole("option", { name: `${ticket.shorthand} Workspace selection`, exact: true });
    const file = sidenav.getByRole("option", { name: "plan.md", exact: true });
    const rootRow = sidenav.getByRole("option", { name: "Project folder", exact: true });
    const linkedRow = sidenav.getByRole("option", { name: linkedWorkspace.workspace_shorthand, exact: true });
    await page.goto(board);
    const card = page.getByTestId("renderer-card").filter({ hasText: "Workspace selection" });
    await card.getByText("Workspace selection", { exact: true }).click();
    await expect(body).toHaveAttribute("aria-selected", "true");
    const finishObservingRows = await observeTreeRows(sidenav, [
      body,
      file,
      rootRow,
      sidenav.getByRole("option", { name: "Search", exact: true }),
      sidenav.getByRole("option", { name: "Settings", exact: true }),
    ]);
    await rootRow.click();
    await expect(rootRow).toHaveAttribute("aria-selected", "true");
    await expect(body).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(ticket.shorthand);
    await sidenav.getByRole("option", { name: "Workspace conversation", exact: true }).click();
    await expect(page.locator('[data-workbench-region="side"]')).toBeVisible();
    await expect(rootRow).toHaveAttribute("aria-selected", "true");
    await expect(body).toHaveAttribute("aria-selected", "false");
    await page.getByRole("button", { name: "Hide Side Panel" }).click();
    expect(await finishObservingRows()).toEqual([]);
    await linkedRow.click();
    const expectLinkedWorkspace = async () => {
      await expect(page).toHaveURL(
        (url) => defaultPageResourceCodec.fromUri(url.searchParams.get("resource") ?? "")?.id === linkedWorkspace.id,
      );
      await expect(page.getByRole("button", { name: "Back to project", exact: true })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(ticket.shorthand);
    };
    await expectLinkedWorkspace();
    await page.goBack();
    await expect(rootRow).toHaveAttribute("aria-selected", "true");
    await page.goForward();
    await expectLinkedWorkspace();
    await page.goBack();
    await expect(rootRow).toHaveAttribute("aria-selected", "true");
    const finishObservingProjectRows = await observeTreeRows(sidenav, [body, file, rootRow]);
    await file.click();
    await expect(file).toHaveAttribute("aria-selected", "true");
    await rootRow.click();
    await expect(rootRow).toHaveAttribute("aria-selected", "true");
    await expect(file).toHaveAttribute("aria-selected", "false");
    await page.goBack();
    await expect(file).toHaveAttribute("aria-selected", "true");
    await body.click();
    await expect(body).toHaveAttribute("aria-selected", "true");
    await expect(file).toHaveAttribute("aria-selected", "false");
    expect(await finishObservingProjectRows()).toEqual([]);
  } finally {
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  }
});
