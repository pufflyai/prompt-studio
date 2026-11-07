import { afterEach, expect, test } from "bun:test";
import { workspacePages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
import { registerWorkspaceProviderViews } from "@/workspaces-provider.test-support";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";

afterEach(() => {
  for (const table of ["workspaces", "sessions", "workspace_sessions"] as const) getWriter(table)?.truncateAndWrite([]);
});

test("project folder navigation keeps project links; opening a workspace replaces them with its sessions", async () => {
  const workbench = createWorkbench();
  registerWorkspaceProviderViews(workbench);
  for (const module of [createSidenavModule(), createWorkspacesModule(), createSessionsModule()])
    workbench.registerModule(module);
  selectDashboardProject(workbench, { id: "project", name: "Project" });
  getWriter("workspaces")?.truncateAndWrite([
    { id: "folder", project_id: "project", name: "Project folder", is_default: true, archived: false },
    { id: "workspace", project_id: "project", name: "Workspace", archived: false },
  ]);
  getWriter("sessions")?.truncateAndWrite([
    {
      id: "folder-session",
      project_id: "project",
      title: "Folder session",
      archived: false,
      updated_at: "2026-11-06T10:00:00Z",
    },
    {
      id: "workspace-session",
      project_id: "project",
      title: "Workspace session",
      archived: false,
      updated_at: "2026-11-06T11:00:00Z",
    },
  ]);
  getWriter("workspace_sessions")?.truncateAndWrite([
    { id: "folder-link", workspace_id: "folder", session_id: "folder-session" },
    { id: "workspace-link", workspace_id: "workspace", session_id: "workspace-session" },
  ]);
  workbench.navigationTrees.registerContribution({
    id: "test.workspaces",
    owner: { kind: "mode", id: "project", extensionId: "pstdio" },
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: () => [{ id: "navigation.root", nodes: [{ id: "workspaces", label: "Workspaces" }] }],
  });
  const folder = { type: "workspace", id: "folder", label: "Project folder" };
  workbench.pageLocations.setProject("project");
  expect(
    workbench.pageLocations.navigate({ kind: "page", page: workspacePages.files, resource: folder }),
  ).toMatchObject({ ok: true });
  const nodes = async () =>
    (await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav))
      .flatMap((section) => section.nodes)
      .filter((node) => !node.pinnedOnly);
  expect((await nodes()).map((node) => node.label)).toContain("Workspaces");
  expect((await nodes()).find((node) => node.id === "workspace-sessions")).toBeUndefined();

  openWorkspacesPage(workbench, { type: "workspace", id: "workspace", label: "Workspace" });
  const workspaceNodes = await nodes();
  expect(workspaceNodes.map((node) => node.label)).not.toContain("Workspaces");
  expect(
    workspaceNodes
      .find((node) => node.id === "workspace-sessions")
      ?.children?.filter((node) => node.resource)
      .map((node) => node.label),
  ).toEqual(["Workspace session"]);
  workbench.pageLocations.goBack();
  expect(workbench.pages.store.getState().location?.page).toEqual(workspacePages.files);
  expect((await nodes()).map((node) => node.label)).toContain("Workspaces");
  expect((await nodes()).find((node) => node.id === "workspace-sessions")).toBeUndefined();
  workbench.dispose();
});
