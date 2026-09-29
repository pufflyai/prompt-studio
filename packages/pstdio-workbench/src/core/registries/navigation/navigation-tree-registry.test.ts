import { describe, expect, test } from "bun:test";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

const project = { kind: "mode" as const, id: "project", extensionId: "pstdio" };

describe("navigation tree registry", () => {
  test("cancelling composed navigation prevents later contribution reads", async () => {
    const controller = new AbortController();
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const registry = createNavigationTreeRegistry();
    let laterReads = 0;
    registry.registerContribution({
      id: "first",
      owner: project,
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: async () => {
        entered.resolve();
        await released.promise;
        return [];
      },
    });
    registry.registerContribution({
      id: "later",
      owner: project,
      sourceExtensionId: "pstdio",
      declarationIndex: 1,
      getSections: () => {
        laterReads++;
        return [];
      },
    });
    const result = registry.getSections(project, "content", { signal: controller.signal });
    await entered.promise;
    controller.abort();
    released.resolve();
    await expect(result).rejects.toThrow();
    expect(laterReads).toBe(0);
  });
  test("keeps owner declarations first and sorts foreign extensions by fully qualified id", async () => {
    const registry = createNavigationTreeRegistry();
    registry.registerContribution({
      id: "zeta.items",
      owner: project,
      sourceExtensionId: "zeta.extension",
      declarationIndex: 0,
      getSections: () => [{ id: "zeta", label: "Zeta", nodes: [] }],
    });
    registry.registerContribution({
      id: "project.second",
      owner: project,
      sourceExtensionId: "pstdio",
      declarationIndex: 1,
      getSections: () => [{ id: "project", nodes: [{ id: "notifications", label: "Notifications" }] }],
    });
    registry.registerContribution({
      id: "alpha.items",
      owner: project,
      sourceExtensionId: "alpha.extension",
      declarationIndex: 0,
      getSections: () => [{ id: "alpha", label: "Alpha", nodes: [] }],
    });
    registry.registerContribution({
      id: "project.first",
      owner: project,
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: () => [{ id: "project", nodes: [{ id: "search", label: "Search" }] }],
    });

    expect((await registry.getSections(project, "content")).map((section) => section.id)).toEqual([
      "project",
      "alpha",
      "zeta",
    ]);
    expect((await registry.getSections(project, "content"))[0]?.nodes.map((node) => node.id)).toEqual([
      "search",
      "notifications",
    ]);
  });

  test("places extension sections without a label in the root section", async () => {
    const registry = createNavigationTreeRegistry();
    registry.registerContribution({
      id: "project.nav",
      owner: project,
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: () => [{ id: "navigation.root", nodes: [{ id: "search", label: "Search" }] }],
    });
    registry.registerContribution({
      id: "lab.examples",
      idScope: "lab.examples",
      owner: project,
      sourceExtensionId: "pstdio.extension-lab",
      declarationIndex: 0,
      getSections: () => [{ id: "examples", label: "Examples", nodes: [{ id: "scribble", label: "Scribble" }] }],
    });
    registry.registerContribution({
      id: "note-list",
      idScope: "note-list",
      owner: project,
      sourceExtensionId: "pstdio.pstdio-notes",
      declarationIndex: 0,
      getSections: () => [
        { id: "notes", nodes: [{ id: "notes", label: "Notes", children: [{ id: "n1", label: "N1" }] }] },
      ],
    });

    const sections = await registry.getSections(project, "content");
    expect(sections.map((section) => section.id)).toEqual(["navigation.root", "lab.examples:examples"]);
    expect(sections[0]?.nodes.map((node) => node.id)).toEqual(["search", "note-list:notes"]);
    expect(sections[0]?.nodes[1]?.children?.map((node) => node.id)).toEqual(["note-list:n1"]);
  });
  test("attaches one opaque owner key to every section and row", async () => {
    const registry = createNavigationTreeRegistry();
    registry.registerContribution({
      id: "project.items",
      owner: project,
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: () => [
        {
          id: "project",
          nodes: [{ id: "sessions", label: "Sessions", children: [{ id: "one", label: "One" }] }],
        },
      ],
    });

    const section = (await registry.getSections(project, "content"))[0];
    expect(section?.moveScope).toBe("mode:pstdio:project");
    expect(section?.canHide).toBe(true);
    expect(section?.canReorder).toBe(true);
    expect(section?.nodes[0]?.moveScope).toBe("mode:pstdio:project");
    expect(section?.nodes[0]?.canHide).toBe(true);
    expect(section?.nodes[0]?.canReorder).toBe(true);
    expect(section?.nodes[0]?.children?.[0]?.moveScope).toBe("mode:pstdio:project");
  });

  test("keeps page-owned level rows fixed while their sections stay hideable", async () => {
    const registry = createNavigationTreeRegistry();
    const notesPage = { kind: "page" as const, id: "notes", extensionId: "notes" };
    registry.registerContribution({
      id: "notes.list",
      owner: notesPage,
      sourceExtensionId: "notes",
      declarationIndex: 0,
      getSections: () => [
        {
          id: "notes",
          label: "Notes",
          nodes: [
            { id: "note", label: "Note" },
            { id: "pinned", label: "Pinned", canHide: true },
          ],
        },
      ],
    });

    const section = (await registry.getSections(notesPage, "content"))[0];
    expect(section?.canHide).toBe(true);
    expect(section?.nodes.map((node) => node.canHide)).toEqual([false, true]);
  });

  test("keeps projected tree ids separate and delegates lazy children to their source", async () => {
    const registry = createNavigationTreeRegistry();
    const sourceNode = { id: "folder", label: "Folder", collapsible: true };
    registry.registerContribution({
      id: "alpha.tree",
      idScope: "alpha.tree",
      owner: project,
      sourceExtensionId: "alpha.extension",
      declarationIndex: 0,
      defaultExpandedSectionIds: ["files"],
      getSections: () => [{ id: "files", label: "Files", nodes: [sourceNode] }],
      getChildren: (node) => [{ id: `${node.id}-child`, label: "Child" }],
    });
    registry.registerContribution({
      id: "beta.tree",
      idScope: "beta.tree",
      owner: project,
      sourceExtensionId: "beta.extension",
      declarationIndex: 0,
      getSections: () => [{ id: "files", label: "Files", nodes: [{ id: "folder", label: "Folder" }] }],
    });

    const sections = await registry.getSections(project);
    expect(sections.map((section) => section.id)).toEqual(["alpha.tree:files", "beta.tree:files"]);
    expect(sections.map((section) => section.nodes[0]?.id)).toEqual(["alpha.tree:folder", "beta.tree:folder"]);
    expect(registry.getDefaultExpandedSectionIds(project)).toEqual(["alpha.tree:files"]);
    expect(await registry.getChildren(sections[0]!.nodes[0]!)).toEqual([
      expect.objectContaining({ id: "alpha.tree:folder-child", moveScope: "mode:pstdio:project" }),
    ]);
  });
});

test("lazy children retain their owner resource and use the current cancellation signal", async () => {
  const registry = createNavigationTreeRegistry();
  const ticket = { type: "ticket", id: "parent-ticket" };
  const seen: unknown[] = [];
  registry.registerContribution({
    id: "files",
    owner: { kind: "page", id: "ticket", extensionId: "planner" },
    sourceExtensionId: "planner",
    declarationIndex: 0,
    getSections: () => [
      { id: "files", nodes: [{ id: "folder", label: "Folder", children: [{ id: "nested", label: "Nested" }] }] },
    ],
    getChildren: (_node, context) => {
      seen.push(context);
      return [{ id: "deeper", label: "Deeper" }];
    },
  });
  const [section] = await registry.getSections({ kind: "page", id: "ticket", extensionId: "planner" }, "content", {
    resource: ticket,
  });
  const signal = new AbortController().signal;
  const context = { resource: { type: "file", id: "active-child" }, signal };
  const children = await registry.getChildren(section!.nodes[0]!, context);
  await registry.getChildren(children[0]!, context);
  await registry.getChildren(section!.nodes[0]!.children![0]!, context);
  expect(seen).toEqual(Array.from({ length: 3 }, () => ({ resource: ticket, signal })));
});
