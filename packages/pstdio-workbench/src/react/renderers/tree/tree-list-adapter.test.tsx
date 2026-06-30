import { describe, expect, mock, test } from "bun:test";
import { Box } from "@chakra-ui/react";
import { DiffBubble, PaletteShortcut } from "@pstdio/ui";
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

describe("toTreeListSection end content", () => {
  test("renders active command keybindings as trailing content", () => {
    const workbench = createWorkbenchCore();
    workbench.commands.registerCommand({ id: "project.search", label: "Search project" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({ commandId: "project.search", keybinding: "mod+shift+f" });

    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [{ id: "search", label: "Search", commandId: "project.search" }],
      },
      {},
      { workbench },
    );

    expect(section.nodes[0]?.endContent).toMatchObject({
      props: {
        opacity: "0",
        _groupHover: { opacity: "1" },
        children: { type: PaletteShortcut, props: { binding: "mod+shift+f" } },
      },
    });
  });

  test("does not render a chevron for menu-backed tree rows", () => {
    const workbench = createWorkbenchCore();
    workbench.commands.registerCommand({ id: "help.open", label: "Open help" }, { execute: () => undefined });
    workbench.layout.registerMenuItem(resourceContextMenuPath("workspace"), { commandId: "help.open" });

    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [{ id: "help", label: "Help", menuPath: resourceContextMenuPath("workspace") }],
      },
      {},
      { workbench },
    );

    expect(section.nodes[0]?.menuItems).toHaveLength(1);
    expect(section.nodes[0]?.endContent).toBeUndefined();
  });

  test("preserves explicit and diff end content on menu-backed tree rows", () => {
    const workbench = createWorkbenchCore();
    const explicitEndContent = <Box data-testid="custom-end-content" />;
    const workspace = {
      kind: "workspace",
      uri: "pstdio://extension-resource/workspace/ws-1",
      id: "ws-1",
      label: "WS-1",
      metadata: { diffAdditions: 7, diffDeletions: 2 },
    } satisfies ResourceRef;

    workbench.commands.registerCommand({ id: "workspace.open", label: "Open workspace" }, { execute: () => undefined });
    workbench.layout.registerMenuItem(resourceContextMenuPath("workspace"), { commandId: "workspace.open" });

    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [
          {
            id: "explicit",
            label: "Explicit",
            menuPath: resourceContextMenuPath("workspace"),
            endContent: explicitEndContent,
          },
          {
            id: "workspace-ws-1",
            label: "WS-1",
            menuPath: resourceContextMenuPath("workspace"),
            target: { kind: "resource", resource: workspace },
          },
        ],
      },
      {},
      { workbench },
    );

    expect(section.nodes[0]?.endContent).toBe(explicitEndContent);
    expect(section.nodes[1]?.endContent).toMatchObject({
      type: DiffBubble,
      props: { additions: 7, deletions: 2, variant: "ghost", size: "small" },
    });
  });

  test("prefers explicit end content over command keybindings", () => {
    const workbench = createWorkbenchCore();
    const explicitEndContent = <Box data-testid="custom-end-content" />;
    workbench.commands.registerCommand({ id: "project.search", label: "Search project" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({ commandId: "project.search", keybinding: "mod+shift+f" });

    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [{ id: "search", label: "Search", commandId: "project.search", endContent: explicitEndContent }],
      },
      {},
      { workbench },
    );

    expect(section.nodes[0]?.endContent).toBe(explicitEndContent);
  });
});
