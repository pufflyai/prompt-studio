import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef, resourceContextMenuPath } from "../../../core";
import { toTreeListSection } from "./tree-list-adapter";

describe("toTreeListSection", () => {
  test("maps navigation targets and resources onto navigable tree rows", () => {
    const workbench = createWorkbenchCore();
    const ticketsResource = {
      kind: "dashboard-view",
      uri: "dashboard-workbench://dashboard-view/tickets",
      id: "tickets",
      label: "Tickets",
    } satisfies ResourceRef;
    const nodes = [
      {
        id: "search",
        label: "Search",
        target: { kind: "command" as const, commandId: "workbench.toggleCommandPalette" },
      },
      {
        id: "tickets",
        label: "Tickets",
        resource: ticketsResource,
      },
    ];

    const section = toTreeListSection({ id: "primary", nodes }, {}, { workbench });

    expect(section.nodes[0]).toMatchObject({
      isNavigable: true,
      navigationIntent: {
        id: "target",
        payload: { kind: "command", commandId: "workbench.toggleCommandPalette" },
      },
    });
    expect(section.nodes[1]).toMatchObject({
      isNavigable: true,
      navigationIntent: {
        id: "resource",
        payload: ticketsResource,
      },
    });
  });

  test("adds resource context menu items to resource target tree rows", async () => {
    const workbench = createWorkbenchCore();
    const requestParams = mock();
    const execute = mock();
    const workspace = {
      kind: "workspace",
      uri: "pstdio://extension-resource/workspace/ws-1",
      id: "ws-1",
      label: "WS-1",
    } satisfies ResourceRef;

    workbench.context.set("workbench.resource.kind", "ticket");
    workbench.commands.registerCommand(
      {
        id: "workspace.review",
        label: "Run review",
        params: {
          harness: { type: "harness", label: "Harness" },
        },
      },
      { execute },
    );
    workbench.layout.registerMenuItem(resourceContextMenuPath("workspace"), {
      commandId: "workspace.review",
      when: 'workbench.resource.kind == "workspace"',
    });

    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [
          {
            id: "workspace-ws-1",
            label: "WS-1",
            target: { kind: "resource", resource: workspace },
          },
        ],
      },
      {},
      { workbench, onRequestParams: requestParams },
    );

    const [action] = section.nodes[0]?.contextMenuItems ?? [];
    expect(action?.label).toBe("Run review");

    action?.onAction?.();

    expect(requestParams).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          context: { resource: workspace },
        }),
      }),
    );

    const request = requestParams.mock.calls[0]?.[0];
    await request?.run({ harness: { harnessId: "codex" } });

    expect(execute).toHaveBeenCalledWith({ harness: { harnessId: "codex" } }, { resource: workspace });
  });

  test("uses the same action set for row overflow and right-click menus", () => {
    const workbench = createWorkbenchCore();
    const workspace = {
      kind: "workspace",
      uri: "pstdio://extension-resource/workspace/ws-1",
      id: "ws-1",
      label: "WS-1",
    } satisfies ResourceRef;

    workbench.commands.registerCommand(
      { id: "workspace.archive", label: "Archive workspace" },
      { execute: () => undefined },
    );
    workbench.layout.registerMenuItem(resourceContextMenuPath("workspace"), {
      commandId: "workspace.archive",
      group: "kernel",
    });

    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [
          {
            id: "workspace-ws-1",
            label: "WS-1",
            menuPath: resourceContextMenuPath("workspace"),
            contextMenuActions: [{ id: "review", label: "Run review", icon: "Search" }],
            target: { kind: "resource", resource: workspace },
          },
        ],
      },
      {},
      { workbench },
    );

    const overflowLabels = section.nodes[0]?.menuItems?.map((item) => item.label);
    const contextLabels = section.nodes[0]?.contextMenuItems?.map((item) => item.label);

    expect(overflowLabels).toEqual(["Run review", "Archive workspace"]);
    expect(contextLabels).toEqual(overflowLabels);
    expect(section.nodes[0]?.menuItems?.[1]).toMatchObject({ separatorBefore: true });
  });

  test("renders workspace diff metadata as trailing content", () => {
    const workbench = createWorkbenchCore();
    const workspace = {
      kind: "workspace",
      uri: "pstdio://extension-resource/workspace/ws-1",
      id: "ws-1",
      label: "WS-1",
      metadata: { diffAdditions: 7, diffDeletions: 2 },
    } satisfies ResourceRef;

    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [{ id: "workspace-ws-1", label: "WS-1", target: { kind: "resource", resource: workspace } }],
      },
      {},
      { workbench },
    );

    expect(section.nodes[0]?.endContent).toBeDefined();
  });

  test("maps section empty states to disabled empty-state rows", () => {
    const workbench = createWorkbenchCore();

    const section = toTreeListSection(
      {
        id: "files",
        label: "Files",
        emptyState: { title: "No files", description: "Create a file.", icon: "FileText" },
        nodes: [],
      },
      {},
      { workbench },
    );

    expect("emptyState" in section).toBe(false);
    expect(section.nodes).toHaveLength(1);
    expect(section.nodes[0]).toMatchObject({
      id: "files:empty",
      label: "No files",
      description: "Create a file.",
      disabled: true,
      rowVariant: "empty-state",
    });
    expect(section.nodes[0]?.icon).toBeDefined();
  });
});
