import { expect, test } from "bun:test";
import { commandRefId, workbenchPages, workspaceCommands, workspaceViews } from "@pstdio/sdk/extensions";
import { createWorkbench, workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { registerWorkspaceProviderViews } from "@/workspaces-provider.test-support";
import { createWorkspacesModule } from "./module";

test("workspace infrastructure preserves old public page refs using provider views without core presentation", () => {
  const workbench = createWorkbench();
  registerWorkspaceProviderViews(workbench);
  workbench.registerModule(createWorkspacesModule());
  expect(workbench.pages.getPage(workbenchPages.workspaces.id)?.main).toMatchObject({
    kind: "view",
    view: workspaceViews.list,
  });
  expect(workbench.pages.getPage(workbenchPages.workspace.id)?.slots.map((slot) => slot.item)).toEqual([
    { kind: "view", view: workspaceViews.history, presence: "open" },
    { kind: "view", view: workspaceViews.file, presence: "open" },
    { kind: "view", view: workspaceViews.changes, presence: "open" },
  ]);
  expect(workbench.views.getView(workspaceViews.file.id)).toBeUndefined();
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
    views[0]!.dispose();
    expect(entries()).toHaveLength(0);
  } finally {
    workbench.dispose();
  }
});
