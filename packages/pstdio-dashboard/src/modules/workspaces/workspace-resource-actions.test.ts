import { describe, expect, test } from "bun:test";
import {
  createWorkbenchCore,
  resourceContextMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-workbench/core";
import { dashboardCommandIds } from "../../shared/app/commands";
import { registerWorkspaceResourceActions } from "./workspace-resource-actions";

const workspaceActionCommandIds = new Set<string>([
  dashboardCommandIds.renameWorkspace,
  dashboardCommandIds.archiveWorkspace,
  dashboardCommandIds.deleteWorkspace,
]);

describe("registerWorkspaceResourceActions", () => {
  test("keeps workspace header and context menu actions in the same kernel group", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "test.workspace-actions",
      activate: (ctx) => {
        registerWorkspaceResourceActions(ctx);
        return undefined;
      },
    });

    const headerActions = workbench.layout
      .listMenuItems(workbenchTopHeaderTrailingMenuPath)
      .filter((action) => workspaceActionCommandIds.has(action.commandId));
    const contextActions = workbench.layout
      .listMenuItems(resourceContextMenuPath("workspace"))
      .filter((action) => workspaceActionCommandIds.has(action.commandId));

    const expectedActions = [...workspaceActionCommandIds].map((commandId) => ({ commandId, group: "kernel" }));

    expect(headerActions.map((action) => ({ commandId: action.commandId, group: action.group }))).toEqual(
      expectedActions,
    );
    expect(contextActions.map((action) => ({ commandId: action.commandId, group: action.group }))).toEqual(
      expectedActions,
    );
  });
});
