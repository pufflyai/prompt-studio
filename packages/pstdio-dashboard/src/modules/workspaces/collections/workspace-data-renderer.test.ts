import { describe, expect, test } from "bun:test";
import {
  createWorkbenchCore,
  type DataRendererQueryState,
  resourceContextMenuPath,
  workbenchResourceKindContextKey,
  workbenchResourceMetadataContextKey,
} from "@pstdio/workbench/core";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createWorkspacesModule } from "../module";

const queryState = {
  settings: {
    viewMode: "list",
    columnGrouping: "none",
    rowGrouping: "none",
    ordering: { attributeId: "created", direction: "asc" },
    displayProperties: ["id", "type"],
  },
  filters: {},
} satisfies DataRendererQueryState;

const workspaceActionWhen = `${workbenchResourceKindContextKey} == "workspace" && !${workbenchResourceMetadataContextKey("workspaceIsDefault")}`;

describe("workspace data renderer", () => {
  test("uses the shared workspace resource context menu for row actions", async () => {
    const workbench = createWorkbenchCore();
    const inspectedWorkspaceIds: string[] = [];

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.commands.registerCommand(
      { id: "test.inspectWorkspace", label: "Inspect workspace", icon: "Search" },
      {
        execute: (_args, context) => {
          if (context?.resource?.id) inspectedWorkspaceIds.push(context.resource.id);
        },
      },
    );
    workbench.layout.registerMenuItem(resourceContextMenuPath("workspace"), {
      commandId: "test.inspectWorkspace",
      when: workspaceActionWhen,
      order: 5,
    });

    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-default",
        project_id: "project-1",
        name: null,
        branch: "main",
        worktree_path: null,
        archived: false,
        workspace_shorthand: "main",
        setup_error: null,
        is_default: true,
        created_at: "2026-05-20T08:10:00Z",
        updated_at: "2026-05-20T08:50:00Z",
        deleted_at: null,
      },
      {
        id: "workspace-1",
        project_id: "project-1",
        name: "Dashboard workbench datalayer",
        branch: "workspace/PS-307_A1",
        worktree_path: null,
        archived: false,
        workspace_shorthand: "PS-307_A1",
        setup_error: null,
        is_default: false,
        created_at: "2026-05-22T08:10:00Z",
        updated_at: "2026-05-22T08:50:00Z",
        deleted_at: null,
      },
    ]);

    const renderer = workbench.renderers.getDataRenderer(dashboardWidgetIds.workspaces);
    const rows = await Promise.resolve(renderer?.executeQuery(queryState) ?? []);
    const defaultRow = rows.find((row) => row.attributes.isDefault);
    const workspaceRow = rows.find((row) => row.id === "dashboard-workbench://workspace/workspace-1");

    expect(workspaceRow).toBeDefined();
    expect(
      renderer?.getRowContextMenuActions?.(workspaceRow!).map((action) => ({
        label: action.label,
        hasIcon: Boolean(action.icon),
        separatorBefore: action.separatorBefore,
      })),
    ).toEqual([
      { label: "Inspect workspace", hasIcon: true, separatorBefore: undefined },
      { label: "Open terminal", hasIcon: true, separatorBefore: true },
      { label: "Rename workspace", hasIcon: true, separatorBefore: undefined },
      { label: "Archive workspace", hasIcon: true, separatorBefore: undefined },
      { label: "Delete workspace", hasIcon: true, separatorBefore: undefined },
    ]);
    expect(renderer?.getRowContextMenuActions?.(defaultRow!)?.map((action) => action.label)).toEqual(["Open terminal"]);

    renderer?.getRowContextMenuActions?.(workspaceRow!)?.[0]?.onClick();
    await Promise.resolve();

    expect(inspectedWorkspaceIds).toEqual(["workspace-1"]);
  });
});
