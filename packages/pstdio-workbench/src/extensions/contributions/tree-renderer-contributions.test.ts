import { describe, expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { resolveTreeListSelection } from "../../react/renderers/tree/tree-list-adapter";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";
import { metadata, treeId } from "./tree-renderer-contributions.fixture";

describe("extension tree renderer contributions", () => {
  test("runs a host tree action in the workbench with its parameters", async () => {
    const workbench = createWorkbench();
    const calls: unknown[] = [];
    const params = { anchors: [{ type: "ticket", id: "ticket-1" }] };
    workbench.commands.registerCommand(
      { id: "workbench.workspace.create", label: "Create workspace" },
      { execute: (args) => calls.push(args) },
    );
    workbench.registerModule({
      id: "test.host-tree-action",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: (commandId) => {
            expect(commandId).toBe("pstdio.lab.tree.body");
            return [
              {
                id: "workspaces",
                nodes: [],
                actions: [
                  {
                    id: "create",
                    command: { extensionId: "pstdio", kind: "command", id: "workbench.workspace.create" },
                    params,
                  },
                ],
              },
            ];
          },
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    const sections = await getWorkbenchRenderers(workbench).getBody(treeId);
    await sections[0]?.actions?.[0]?.run?.(params);
    expect(calls).toEqual([params]);
  });
});

describe("extension tree resource navigation", () => {
  test("closes a note opened from a tree when its project reports removal", async () => {
    const workbench = createWorkbench();
    const page = { kind: "page", extensionId: "pstdio.lab", id: "notes" } as const;
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({ id: "editor", title: "Note", body: { kind: "react", render: () => null } });
    workbench.pages.registerPage({
      id: "notes",
      ref: page,
      path: "notes",
      modeId: "project",
      main: { kind: "panels", empty: { kind: "view", id: "editor" } },
      slots: [
        {
          id: "note",
          region: "main",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", id: "note", extensionId: "pstdio.lab" }],
              view: { kind: "view", id: "editor" },
              cardinality: "many",
            },
          },
        },
      ],
    });
    workbench.pageLocations.setProject("project-1");
    workbench.registerModule({
      id: "test.extension-tree",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: () => [
            {
              id: "notes",
              nodes: [
                {
                  id: "one",
                  label: "One",
                  target: {
                    kind: "compound",
                    targets: [
                      { kind: "page", page },
                      {
                        kind: "panel",
                        panel: { kind: "page-slot", page, id: "note" },
                        resource: { type: "note", id: "one" },
                        open: "pin",
                      },
                    ],
                  },
                },
              ],
            },
          ],
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    const sections = await getWorkbenchRenderers(workbench).getBody(treeId);
    await workbench.navigation.openTarget(sections[0]!.nodes[0]!.target!);
    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(1);

    workbench.resources.removed({ type: "note", id: "one", extensionId: "pstdio.lab", projectId: "project-1" });

    expect(
      Object.values(workbench.pages.store.getState().pageStates).flatMap((state) =>
        Object.values(state.resourceInstances).flat(),
      ),
    ).toEqual([]);
  });

  test.each([
    "body",
    "first-file",
    "second-file",
  ])("preserves the declared document selection in a composed navigation tree: %s", async (documentId) => {
    const workbench = createWorkbench();
    const page = { kind: "page", extensionId: "pstdio.lab", id: "ticket" } as const;
    const resource = { type: "ticket", id: "ticket-1", metadata: { documentId } };
    workbench.registerModule({
      id: "test.extension-tree",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: () => [
            {
              id: "documents",
              nodes: ["body", "first-file", "second-file"].map((id) => ({
                id,
                label: id,
                selected: id === documentId,
                target: { kind: "page", page, resource: { ...resource, metadata: { documentId: id } } },
              })),
            },
          ],
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    workbench.navigationTrees.registerContribution({
      id: "files",
      idScope: "files",
      owner: page,
      sourceExtensionId: "pstdio.lab",
      declarationIndex: 0,
      viewId: treeId,
    });
    const sections = await workbench.navigationTrees.getSections(page, "content", { resource });
    expect(
      resolveTreeListSelection({
        sections,
        childrenByNodeId: {},
        activeLocation: { page, resource },
        activeResource: resource,
        selectedNodeId: "session:previous",
      }),
    ).toBe(`files:${documentId}`);
  });
  test("applies explicit navigation from a tree action", async () => {
    const startPage = { kind: "page", extensionId: "pstdio.lab", id: "start" } as const;
    const page = { kind: "page", extensionId: "pstdio.lab", id: "ticket" } as const;
    const workbench = createWorkbench({ startPage });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    for (const id of ["start", "ticket"]) {
      workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
    }
    workbench.pages.registerPage({
      id: "start",
      ref: startPage,
      path: "start",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "start" }, cardinality: "one" },
      slots: [],
    });
    workbench.pages.registerPage({
      id: "ticket",
      ref: page,
      path: "ticket",
      modeId: "project",
      parentId: "start",
      resource: { kinds: [{ kind: "resource-kind", id: "ticket" }] },
      main: { kind: "view", view: { kind: "view", id: "ticket" }, cardinality: "one" },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    const ticket = { type: "ticket", id: "ticket-1" };
    const openFile = { ...ticket, metadata: { documentId: "file-1" } };
    workbench.registerModule({
      id: "test.extension-tree",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: (commandId) => {
            if (commandId === "pstdio.lab.command.delete-file")
              return {
                outcome: {
                  ok: true,
                  status: "success",
                  value: { id: "file-1" },
                  navigationRequests: [{ kind: "page", page, resource: ticket }],
                },
              };
            return [
              {
                id: "files",
                nodes: [{ id: "file-1", label: "notes.md" }],
                actions: [{ id: "delete", label: "Delete", command: { kind: "command", id: "delete-file" } }],
              },
            ];
          },
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    workbench.navigationTrees.registerContribution({
      id: "files",
      idScope: "files",
      owner: page,
      sourceExtensionId: "pstdio.lab",
      declarationIndex: 0,
      viewId: treeId,
    });
    workbench.pageLocations.navigate({ kind: "page", page, resource: openFile });
    const sections = await workbench.navigationTrees.getSections(page, "content", { resource: openFile });

    await sections[0]?.actions?.[0]?.run?.({});

    expect(workbench.pages.store.getState().location?.resource).toEqual(ticket);
  });
  test("does not send host-owned nodes to the extension children handler", async () => {
    const workbench = createWorkbench();
    const calls: string[] = [];
    workbench.registerModule({
      id: "test.extension-tree",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: (commandId) => {
            calls.push(commandId);
            return [];
          },
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    const hostChild = { id: "host-child", label: "Host child" };

    const children = await getWorkbenchRenderers(workbench).getChildren(treeId, {
      id: "host",
      label: "Host",
      children: [hostChild],
    });

    expect(children).toEqual([hostChild]);
    expect(calls).toEqual([]);
  });
});

describe("existing extension behavior during SDK preparation", () => {
  test("opens the navigation target a tree action returns", async () => {
    const startPage = { kind: "page", extensionId: "pstdio.lab", id: "start" } as const;
    const page = { kind: "page", extensionId: "pstdio.lab", id: "ticket" } as const;
    const workbench = createWorkbench({ startPage });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    for (const id of ["start", "ticket"]) {
      workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
    }
    workbench.pages.registerPage({
      id: "start",
      ref: startPage,
      path: "start",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "start" }, cardinality: "one" },
      slots: [],
    });
    workbench.pages.registerPage({
      id: "ticket",
      ref: page,
      path: "ticket",
      modeId: "project",
      parentId: "start",
      resource: { kinds: [{ kind: "resource-kind", id: "ticket" }] },
      main: { kind: "view", view: { kind: "view", id: "ticket" }, cardinality: "one" },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    const ticket = { type: "ticket", id: "ticket-1" };
    const openFile = { ...ticket, metadata: { documentId: "file-1" } };
    workbench.registerModule({
      id: "test.extension-tree",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: (commandId) => {
            if (commandId === "pstdio.lab.command.delete-file") return { kind: "page", page, resource: ticket };
            return [
              {
                id: "files",
                nodes: [{ id: "file-1", label: "notes.md" }],
                actions: [{ id: "delete", label: "Delete", command: { kind: "command", id: "delete-file" } }],
              },
            ];
          },
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    workbench.navigationTrees.registerContribution({
      id: "files",
      idScope: "files",
      owner: page,
      sourceExtensionId: "pstdio.lab",
      declarationIndex: 0,
      viewId: treeId,
    });
    workbench.pageLocations.navigate({ kind: "page", page, resource: openFile });
    const sections = await workbench.navigationTrees.getSections(page, "content", { resource: openFile });

    await sections[0]?.actions?.[0]?.run?.({});

    expect(workbench.pages.store.getState().location?.resource).toEqual({
      ...ticket,
      extensionId: "pstdio.lab",
      projectId: "project-1",
    });
  });
});
