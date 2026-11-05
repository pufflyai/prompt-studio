import { expect, test } from "bun:test";
import type { DashboardWorkspaceOption } from "@/shared/workspaces/workspace-options";
import { canonicalWorkspaceHostResource } from "./workspace-host-actions";

const option: DashboardWorkspaceOption = {
  id: "one",
  title: "One",
  shorthand: "WS-1",
  branch: null,
  type: "folder",
  isDefault: false,
  executionKind: "local",
  providerState: "ready",
  supportsFiles: true,
  supportsDiff: false,
  supportsDelete: true,
  workspacePath: "/stale",
  updatedAt: "",
};
const row = {
  id: "one",
  projectId: "project",
  rootPath: "/live",
  executionKind: "local",
  providerState: "ready",
  initializing: false,
  setupError: null,
  capabilities: { files: "write" },
};
const resource = {
  type: "workspace",
  id: "one",
  projectId: "project",
  metadata: { workspacePath: "/private", workspaceExecutionKind: "local", workspaceProviderState: "ready" },
};

test("terminal and reveal use the live scoped target instead of caller path metadata", async () => {
  const result = await canonicalWorkspaceHostResource(resource, {
    projectId: "project",
    options: [option],
    get: async () => row as never,
  });
  expect(result.metadata?.workspacePath).toBe("/live");
  for (const change of [
    { projectId: "foreign" },
    { providerState: "failed" },
    { executionKind: "remote" },
    { initializing: true },
    { setupError: "failed" },
    { device: { id: "foreign", name: "Other", ownerId: "owner" } },
  ])
    await expect(
      canonicalWorkspaceHostResource(resource, {
        projectId: "project",
        options: [option],
        get: async () => ({ ...row, ...change }) as never,
      }),
    ).rejects.toThrow("unavailable");
  await expect(
    canonicalWorkspaceHostResource(
      { ...resource, projectId: "foreign" },
      {
        projectId: "project",
        options: [option],
        get: async () => {
          throw new Error("Must not fetch foreign project");
        },
      },
    ),
  ).rejects.toThrow("project");
});

test("command navigation opens the explicit clicked workspace when another workspace is active", async () => {
  const { createWorkbench } = await import("@pstdio/workbench");
  const { createWorkbenchTerminalModule, WORKBENCH_TERMINAL_WIDGET_ID } = await import("@pstdio/workbench/react");
  const { registerWorkspaceHostActions } = await import("./workspace-host-actions");
  const { dashboardCommandIds } = await import("@/shared/app/commands");
  const workbench = createWorkbench();
  workbench.registerModule(createWorkbenchTerminalModule());
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({
    id: "test.workspace",
    title: "Workspace",
    body: { kind: "react", render: () => null },
  });
  const page = { kind: "page" as const, extensionId: "test", id: "workspace" };
  workbench.pages.registerPage({
    id: "test.workspace",
    ref: page,
    path: "workspace",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels" },
    slots: [],
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({
    kind: "page",
    page,
    resource: { type: "workspace", id: "active", projectId: "project" },
  });
  let resolved: string | undefined;
  workbench.registerModule({
    id: "test.host-actions",
    activate: (ctx) => {
      registerWorkspaceHostActions(ctx, async (_ctx, resource) => {
        resolved = resource.id;
        return {
          ...resource,
          metadata: {
            workspaceId: resource.id,
            workspacePath: "/scope/clicked",
            workspaceProviderState: "ready",
            workspaceExecutionKind: "local",
          },
        };
      });
    },
  });
  await workbench.commands.executeCommand(
    dashboardCommandIds.openWorkspaceTerminal,
    { workspaceId: "clicked" },
    { projectId: "project" },
  );
  expect(resolved).toBe("clicked");
  expect(
    workbench.layout.listPanelInstances("secondary").find((panel) => panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID)
      ?.resource?.metadata?.workspaceId,
  ).toBe("clicked");
  workbench.dispose();
});
