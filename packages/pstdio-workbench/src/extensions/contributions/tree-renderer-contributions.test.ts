import { describe, expect, test } from "bun:test";
import type { CommandExecuteRequest, CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";

const metadata = {
  extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "/extensions/lab" }],
  commands: [
    { id: "lab.files.body", extensionId: "pstdio.lab", title: "List files" },
    { id: "lab.files.children", extensionId: "pstdio.lab", title: "List children" },
    { id: "lab.files.footer", extensionId: "pstdio.lab", title: "List footer" },
    { id: "lab.files.open", extensionId: "pstdio.lab", title: "Open file" },
    { id: "lab.files.delete", extensionId: "pstdio.lab", title: "Delete file" },
  ],
  diagnostics: [],
  menuContributions: [],
  modes: [],
  navigation: [],
  routes: [],
  settingsPanels: [],
  treeItems: [],
  kanbanRenderers: [],
  panels: [
    {
      id: "lab.ticketFiles",
      extensionId: "pstdio.lab",
      region: "main",
      title: "Files",
      closable: false,
      resourceKind: "ticket",
      treeRendererId: "lab.files",
    },
  ],
  treeRenderers: [
    {
      id: "lab.files",
      extensionId: "pstdio.lab",
      title: "Files",
      icon: "Files",
      bodyCommandId: "lab.files.body",
      childrenCommandId: "lab.files.children",
      footerCommandId: "lab.files.footer",
      defaultExpandedSectionIds: ["files"],
    },
  ],
} satisfies WorkbenchExtensionMetadata;

const success = (commandId: string, value: unknown): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.lab",
  outcome: { ok: true, status: "success", value },
});

describe("registerWorkbenchExtensionTreeRenderers", () => {
  test("registers tree renderers, tree-backed panel widgets, and command-backed callbacks", async () => {
    const workbench = createWorkbenchCore();
    const calls: { commandId: string; body: CommandExecuteRequest }[] = [];

    registerWorkbenchExtensionTreeRenderers({
      executeCommand: async (commandId, body) => {
        calls.push({ commandId, body });
        if (commandId === "lab.files.body") {
          return success(commandId, [
            {
              id: "files",
              label: "Files",
              emptyState: {
                title: "No files",
                description: "Create one.",
                icon: "FileText",
              },
              nodes: [
                {
                  id: "ticket",
                  label: "ticket.md",
                  rowVariant: "empty-state",
                  disabled: true,
                  target: {
                    kind: "command",
                    commandId: "lab.files.open",
                    args: { ticketId: "ticket-1" },
                  },
                  actions: [
                    {
                      id: "delete",
                      label: "Delete",
                      commandId: "lab.files.delete",
                      args: { ticketId: "ticket-1", fileId: "file-1" },
                    },
                  ],
                },
              ],
            },
          ]);
        }
        if (commandId === "lab.files.children") return success(commandId, [{ id: "child", label: "Child" }]);
        if (commandId === "lab.files.footer") return success(commandId, [{ id: "new", label: "New file" }]);
        return success(commandId, { ok: true });
      },
      metadata,
      projectId: "project-1",
      workbench,
    });

    const resource = { kind: "ticket", uri: "pstdio://ticket/ticket-1", id: "ticket-1", label: "PS-1" };
    const body = await workbench.renderers.getBody("lab.files", { resource });
    const footer = await workbench.renderers.getFooter("lab.files", { resource });
    const children = await workbench.renderers.getChildren("lab.files", body[0]!.nodes[0]!, { resource });

    expect(workbench.renderers.getTreeRenderer("lab.files")).toMatchObject({
      id: "lab.files",
      title: "Files",
      icon: "Files",
    });
    expect(workbench.layout.getPanel("lab.ticketFiles")).toMatchObject({
      region: "main",
      rendererId: "lab.files",
      resourceKinds: ["ticket"],
    });
    expect(body[0]?.nodes[0]).toMatchObject({
      id: "ticket",
      label: "ticket.md",
      rowVariant: "empty-state",
      disabled: true,
      target: {
        kind: "command",
        commandId: "workbench.extensionTreeRenderer.lab.files.command",
      },
    });
    expect(body[0]?.emptyState).toEqual({
      title: "No files",
      description: "Create one.",
      icon: "FileText",
    });
    expect(footer[0]?.label).toBe("New file");
    expect(children[0]?.label).toBe("Child");
    expect(calls[0]).toMatchObject({
      commandId: "lab.files.body",
      body: {
        projectId: "project-1",
        params: {
          treeId: "lab.files",
          resource: { type: "ticket", id: "ticket-1", label: "PS-1" },
          state: { expandedSectionIds: ["files"], expandedNodeIds: [] },
        },
      },
    });

    await workbench.navigation.openTarget(body[0]!.nodes[0]!.target!);
    expect(workbench.renderers.getTreeState("lab.files").selectedNodeId).toBe("ticket");
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.files.open",
      body: {
        params: { ticketId: "ticket-1" },
        resource: { type: "ticket", id: "ticket-1", label: "PS-1" },
      },
    });

    await body[0]!.nodes[0]!.actions![0]!.run!();
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.files.delete",
      body: {
        params: { ticketId: "ticket-1", fileId: "file-1" },
        slot: { id: "lab.files", kind: "renderer" },
      },
    });
  });

  test("refreshes the tree on actions but not on plain node selection", async () => {
    const workbench = createWorkbenchCore();
    let refreshCount = 0;
    const refresh = workbench.renderers.refresh.bind(workbench.renderers);
    workbench.renderers.refresh = (id) => {
      refreshCount += 1;
      return refresh(id);
    };

    registerWorkbenchExtensionTreeRenderers({
      executeCommand: async (commandId) => {
        if (commandId === "lab.files.body") {
          return success(commandId, [
            {
              id: "files",
              label: "Files",
              nodes: [
                {
                  id: "ticket",
                  label: "ticket.md",
                  target: { kind: "command", commandId: "lab.files.open", args: { ticketId: "ticket-1" } },
                  actions: [{ id: "delete", label: "Delete", commandId: "lab.files.delete", args: {} }],
                },
              ],
            },
          ]);
        }
        return success(commandId, { ok: true });
      },
      metadata,
      projectId: "project-1",
      workbench,
    });

    const resource = { kind: "ticket", uri: "pstdio://ticket/ticket-1", id: "ticket-1", label: "PS-1" };
    const body = await workbench.renderers.getBody("lab.files", { resource });

    await workbench.navigation.openTarget(body[0]!.nodes[0]!.target!);
    expect(refreshCount).toBe(0);

    await body[0]!.nodes[0]!.actions![0]!.run!();
    expect(refreshCount).toBe(1);
  });

  test("adds host default header and footer rows only for opted-in tree panels", async () => {
    const workbench = createWorkbenchCore();
    const metadataWithHostDefaults = {
      ...metadata,
      panels: [
        {
          ...metadata.panels[0]!,
          panelMenus: [
            {
              id: "lab.ticketFiles.tools",
              extensionId: "pstdio.lab",
              ownerPanelId: "lab.ticketFiles",
              title: "Ticket files",
              side: "right",
              treeRendererId: "lab.files",
              hostTreeHeader: "default",
              hostTreeFooter: "default",
            },
            {
              id: "lab.ticketFiles.plain",
              extensionId: "pstdio.lab",
              ownerPanelId: "lab.ticketFiles",
              title: "Plain files",
              side: "left",
              treeRendererId: "lab.files",
              hostTreeHeader: "none",
              hostTreeFooter: "none",
            },
          ],
        },
      ],
    } satisfies WorkbenchExtensionMetadata;

    registerWorkbenchExtensionTreeRenderers({
      executeCommand: async (commandId) => {
        if (commandId === "lab.files.body") return success(commandId, []);
        if (commandId === "lab.files.footer") return success(commandId, [{ id: "new", label: "New file" }]);
        return success(commandId, []);
      },
      getHostTreeFooterNodes: ({ panel }) => [{ id: `${panel.id}.settings`, label: "Settings" }],
      getHostTreeHeaderNodes: ({ panel }) => [{ id: `${panel.id}.search`, label: "Search" }],
      metadata: metadataWithHostDefaults,
      projectId: "project-1",
      workbench,
    });

    await expect(workbench.renderers.getHeader("lab.files", { viewId: "lab.ticketFiles.tools" })).resolves.toEqual([
      { id: "lab.ticketFiles.tools.search", label: "Search" },
    ]);
    await expect(workbench.renderers.getFooter("lab.files", { viewId: "lab.ticketFiles.tools" })).resolves.toEqual([
      { id: "new", label: "New file" },
      { id: "lab.ticketFiles.tools.settings", label: "Settings" },
    ]);
    await expect(workbench.renderers.getHeader("lab.files", { viewId: "lab.ticketFiles.plain" })).resolves.toEqual([]);
    await expect(workbench.renderers.getFooter("lab.files", { viewId: "lab.ticketFiles.plain" })).resolves.toEqual([
      { id: "new", label: "New file" },
    ]);
  });

  test("maps resource targets to replace the active resource tab", async () => {
    const workbench = createWorkbenchCore();
    registerWorkbenchExtensionTreeRenderers({
      executeCommand: async (commandId) => {
        if (commandId === "lab.files.body") {
          return success(commandId, [
            {
              id: "workspaces",
              label: "Workspaces",
              nodes: [
                {
                  id: "workspace-ws-1",
                  label: "WS-1",
                  target: { kind: "resource", resource: { type: "workspace", id: "ws-1", label: "WS-1" } },
                },
              ],
            },
          ]);
        }
        return success(commandId, []);
      },
      metadata,
      projectId: "project-1",
      workbench,
    });

    const body = await workbench.renderers.getBody("lab.files", {});

    expect(body[0]?.nodes[0]?.target).toMatchObject({
      kind: "resource",
      input: { replaceActive: true },
    });
  });
});
