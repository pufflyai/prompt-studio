import { describe, expect, test } from "bun:test";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

const project = { kind: "mode" as const, id: "project", extensionId: "pstdio" };

describe("navigation tree registry", () => {
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
