import { describe, expect, mock, test } from "bun:test";
import { Box } from "@chakra-ui/react";
import { PaletteShortcut } from "@pstdio/ui";
import { DiffBubble } from "@pstdio/ui/diff";
import { createWorkbench, type ResourceRef, resourceContextMenuPath } from "../../../core";
import { resolveTreeListSelection, toTreeListSection } from "./tree-list-adapter";

describe("resolveTreeListSelection", () => {
  test("follows a page target's resource when another view changes the route", () => {
    const page = { kind: "page", id: "notes", extensionId: "author.notes" } as const;
    const resource = { type: "note", id: "field" };
    expect(
      resolveTreeListSelection({
        sections: [
          {
            id: "notes",
            nodes: [
              { id: "all", label: "All notes", target: { kind: "page", page: { ...page, id: "all" } } },
              { id: "field", label: "Field notes", target: { kind: "page", page, resource } },
            ],
          },
        ],
        childrenByNodeId: {},
        activeLocation: { page, resource },
        activeResource: resource,
        selectedNodeId: "all",
      }),
    ).toBe("field");
  });
  test("selects one nested section instead of every node with the same resource", () => {
    const resource = {
      type: "markdown",
      id: "guide",
    } satisfies ResourceRef;
    const sections = [
      {
        id: "files",
        nodes: [
          {
            id: "guide",
            label: "guide.md",
            resource,
            children: [
              { id: "intro", label: "Intro", resource },
              { id: "details", label: "Details", resource },
            ],
          },
        ],
      },
    ];
    expect(
      resolveTreeListSelection({
        sections,
        childrenByNodeId: {},
        activeResource: resource,
        selectedNodeId: "details",
      }),
    ).toBe("details");
  });
  test("keeps an explicit selected row when it has no resource identity", () => {
    const activeResource = {
      type: "ticket",
      id: "ticket-1",
    } satisfies ResourceRef;
    expect(
      resolveTreeListSelection({
        sections: [{ id: "ticket", nodes: [{ id: "__ticket__", label: "PS-1 Ticket" }] }],
        childrenByNodeId: {},
        activeResource,
        selectedNodeId: "__ticket__",
      }),
    ).toBe("__ticket__");
  });
});
describe("toTreeListSection", () => {
  test("maps navigation targets and resources onto navigable tree rows", () => {
    const workbench = createWorkbench();
    const ticketsResource = {
      type: "dashboard-view",
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
    const workbench = createWorkbench();
    const requestParams = mock();
    const execute = mock();
    const workspace = {
      type: "workspace",
      id: "ws-1",
      label: "WS-1",
    } satisfies ResourceRef;
    workbench.context.set("workbench.resource.type", "ticket");
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
      when: 'workbench.resource.type == "workspace"',
    });
    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [
          {
            id: "workspace-ws-1",
            label: "WS-1",
            resource: workspace,
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
    const workbench = createWorkbench();
    const workspace = {
      type: "workspace",
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
            resource: workspace,
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
    const workbench = createWorkbench();
    const workspace = {
      type: "workspace",
      id: "ws-1",
      label: "WS-1",
      metadata: { diffAdditions: 7, diffDeletions: 2 },
    } satisfies ResourceRef;
    const section = toTreeListSection(
      {
        id: "primary",
        nodes: [{ id: "workspace-ws-1", label: "WS-1", resource: workspace }],
      },
      {},
      { workbench },
    );
    expect(section.nodes[0]?.endContent).toBeDefined();
  });
  test("maps section empty states to disabled empty-state rows", () => {
    const workbench = createWorkbench();
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
    const workbench = createWorkbench();
    workbench.commands.registerCommand({ id: "project.search", label: "Search project" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "project.search" },
      keybinding: "mod+shift+f",
    });
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
    const workbench = createWorkbench();
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
    const workbench = createWorkbench();
    const explicitEndContent = <Box data-testid="custom-end-content" />;
    const workspace = {
      type: "workspace",
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
            resource: workspace,
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
    const workbench = createWorkbench();
    const explicitEndContent = <Box data-testid="custom-end-content" />;
    workbench.commands.registerCommand({ id: "project.search", label: "Search project" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "project.search" },
      keybinding: "mod+shift+f",
    });
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
