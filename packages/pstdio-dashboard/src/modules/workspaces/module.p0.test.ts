import { expect, test } from "bun:test";
import { commandRefId, workbenchPages, workspaceCommands, workspacePages } from "@pstdio/sdk/extensions";
import { createWorkbench, workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { registerWorkspaceProviderViews } from "@/workspaces-provider.test-support";
import { createWorkspacesModule } from "./module";

test("workspace search offers only installed presentation while retaining the host's records", () => {
  getCollection("workspaces");
  const row = {
    id: "retained",
    project_id: "presentation-absence",
    name: "Retained workspace",
    workspace_shorthand: "WS-1",
    is_default: true,
  };
  getWriter("workspaces")!.upsert(row);
  const w = createWorkbench();
  w.registerModule(createWorkspacesModule());
  selectDashboardProject(w, { id: row.project_id, name: "Absence" });
  const resource = { type: "workspace", id: row.id, extensionId: "pstdio" };
  try {
    expect(w.resources.listResources("")).toEqual([]);
    expect(() => openWorkspacesPage(w, resource)).toThrow("Workspace presentation is unavailable");
    const provider = registerWorkspaceProviderViews(w);
    expect(w.resources.listResources("")).toContainEqual(
      expect.objectContaining({ resource: expect.objectContaining({ id: row.id }) }),
    );
    for (const registration of provider.reverse()) registration.dispose();
    expect(w.resources.listResources("")).toEqual([]);
    expect(w.resources.getKind("workspace", "pstdio")!.resolve!(resource)?.label).toBe(row.name);
  } finally {
    getWriter("workspaces")!.remove(row.id);
    w.dispose();
  }
});

test("workspace infrastructure preserves old public page refs using provider views without core presentation", () => {
  const workbench = createWorkbench();
  registerWorkspaceProviderViews(workbench);
  workbench.registerModule(createWorkspacesModule());
  workbench.pageLocations.setProject("p1");
  expect(workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.workspaces }).ok).toBe(true);
  expect(workbench.pages.store.getState().location?.page).toEqual(workspacePages.list);
  expect(
    workbench.pageLocations.navigate({
      kind: "page",
      page: workbenchPages.workspace,
      resource: { type: "workspace", id: "one" },
    }).ok,
  ).toBe(true);
  expect(workbench.pages.store.getState().location?.page).toEqual(workspacePages.workspace);
  workbench.dispose();
});
test("legacy create command delegates to the provider command without owning another form", async () => {
  const workbench = createWorkbench();
  registerWorkspaceProviderViews(workbench);
  workbench.registerModule(createWorkspacesModule());
  let received: unknown;
  workbench.commands.registerCommand(
    { id: commandRefId(workspaceCommands.create), label: "Create" },
    {
      execute: (args) => {
        received = args;
      },
    },
  );
  await workbench.commands.executeCommand(dashboardCommandIds.createWorkspace, { shorthand_base: "PS-61" });
  expect(received).toEqual({ shorthand_base: "PS-61" });
  workbench.dispose();
});

test("legacy mutation aliases retain clicked resource and viewer guard instead of using the active resource", async () => {
  const workbench = createWorkbench();
  registerWorkspaceProviderViews(workbench);
  workbench.registerModule(createWorkspacesModule());
  const invocation = {
    resource: { type: "workspace", id: "clicked" },
    isViewerCurrent: () => true,
    signal: new AbortController().signal,
  };
  let received: unknown;
  workbench.commands.registerCommand(
    { id: commandRefId(workspaceCommands.rename), label: "Rename" },
    {
      execute: (_args, context) => {
        received = context;
      },
    },
  );
  await workbench.commands.executeCommand(dashboardCommandIds.renameWorkspace, {}, invocation);
  expect(received).toBe(invocation);
  workbench.dispose();
});

test("legacy Go to workspaces keeps list navigation when called from a contextual resource", async () => {
  const workbench = createWorkbench();
  registerWorkspaceProviderViews(workbench);
  workbench.registerModule(createWorkspacesModule());
  let received: unknown;
  workbench.commands.registerCommand(
    { id: commandRefId(workspaceCommands.open), label: "Open" },
    {
      execute: (_args, context) => {
        received = context?.resource;
      },
    },
  );
  expect(workbench.layout.listMenuItems(workbenchCommandPaletteMenuPath)).toContainEqual(
    expect.objectContaining({ commandId: dashboardCommandIds.openWorkspaces }),
  );
  await workbench.commands.executeCommand(
    dashboardCommandIds.openWorkspaces,
    {},
    { resource: { type: "session", id: "session" } },
  );
  expect(received).toBeUndefined();
  workbench.dispose();
});

test("workspace palette navigation follows provider availability", () => {
  const workbench = createWorkbench();
  try {
    workbench.registerModule(createWorkspacesModule());
    const entries = () =>
      workbench.layout
        .listMenuItems(workbenchCommandPaletteMenuPath)
        .filter((item) => item.commandId === dashboardCommandIds.openWorkspaces);
    expect(entries()).toHaveLength(0);
    const views = registerWorkspaceProviderViews(workbench);
    expect(entries()).toHaveLength(1);
    for (const registration of views.reverse()) registration.dispose();
    expect(entries()).toHaveLength(0);
  } finally {
    workbench.dispose();
  }
});
