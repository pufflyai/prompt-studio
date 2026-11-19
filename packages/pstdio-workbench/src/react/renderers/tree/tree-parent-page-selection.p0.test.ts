import { expect, test } from "bun:test";
import { createWorkbench, type ResourceRef } from "../../../core";
import { resolveTreeListSelection, resolveTreeSelectionIntent } from "./tree-list-selection";

test("the nearest matching page wins over an ancestor", () => {
  const home = { kind: "page", extensionId: "example.lab", id: "home" } as const;
  const instance = { ...home, id: "instance" };
  const machine = { ...home, id: "machine" };
  const resource = { type: "instance", id: "onefin" };
  expect(
    resolveTreeListSelection({
      sections: [
        {
          id: "lab",
          nodes: [
            { id: "home", label: "Lab", target: { kind: "page", page: home } },
            { id: "instance", label: "Instance", target: { kind: "page", page: instance, resource } },
          ],
        },
      ],
      childrenByNodeId: {},
      activeLocation: { page: machine, parent: { page: instance, resource, parent: { page: home } } },
    }),
  ).toBe("instance");
});

test("a parent navigation item stays selected on a resource child instead of the previous page", () => {
  const lab = { kind: "page", extensionId: "pocketcoder.pocketcoder", id: "instances" } as const;
  const tickets = { kind: "page", extensionId: "pstdio.planner", id: "tickets" } as const;
  const input = {
    sections: [
      {
        id: "project",
        nodes: [
          { id: "tickets", label: "Tickets", target: { kind: "page", page: tickets } as const },
          { id: "lab", label: "Lab", target: { kind: "page", page: lab } as const },
        ],
      },
    ],
    childrenByNodeId: {},
    activeLocation: {
      page: { ...lab, id: "instance" },
      resource: { type: "instance", id: "onefin" },
      parent: { page: lab },
    },
    activeResource: { type: "instance", id: "onefin" },
    selectedNodeId: "tickets",
  };
  expect(resolveTreeListSelection(input)).toBe("lab");
  expect(resolveTreeSelectionIntent({ ...input, selectedNodeId: "lab" })).toBe("lab");
});

for (const resolver of ["selection", "intent"] as const) {
  test(`parent page ${resolver} uses the resource identity resolver`, () => {
    const parent = { kind: "page", extensionId: "example.lab", id: "instance" } as const;
    const input = {
      sections: [
        {
          id: "lab",
          nodes: [
            {
              id: "parent",
              label: "Instance",
              target: { kind: "page", page: parent, resource: { type: "instance", id: "alias:one" } } as const,
            },
          ],
        },
      ],
      childrenByNodeId: {},
      activeLocation: {
        page: { ...parent, id: "machine" },
        parent: { page: parent, resource: { type: "instance", id: "one" } },
      },
      selectedNodeId: resolver === "selection" ? "previous" : "parent",
      resourceReferenceKey: (resource: { id: string }) => resource.id.replace(/^alias:/, ""),
    };
    expect((resolver === "selection" ? resolveTreeListSelection : resolveTreeSelectionIntent)(input)).toBe("parent");
  });
}

test("Files stays selected when the workspace opens a document", () => {
  const files = { kind: "page", extensionId: "pstdio.workspaces", id: "files" } as const;
  const workspaces = { ...files, id: "workspaces" };
  const workbench = createWorkbench();
  workbench.pages.registerPage({
    id: "files",
    modeId: "project",
    ref: files,
    path: "files",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace", extensionId: "pstdio" }] },
    document: { metadataKey: "workspaceFilePath" },
    main: { kind: "panels" },
    slots: [],
  });
  const workspace = { type: "workspace", id: "project-folder", extensionId: "pstdio" };
  const active = { ...workspace, metadata: { workspaceFilePath: "README.md" } };
  const input = {
    sections: [
      {
        id: "project",
        nodes: [
          { id: "files", label: "Files", target: { kind: "page", page: files, resource: workspace } as const },
          { id: "workspaces", label: "Workspaces", target: { kind: "page", page: workspaces } as const },
        ],
      },
    ],
    childrenByNodeId: {},
    activeResource: active,
    activeLocation: { page: files, resource: active, parent: { page: workspaces } },
    selectedNodeId: "files",
    resourceReferenceKey: (resource: ResourceRef) => workbench.pages.resourceReferenceKey(resource),
  };
  expect(resolveTreeListSelection(input)).toBe("files");
  expect(resolveTreeSelectionIntent(input)).toBe("files");
  const document = {
    id: "readme",
    label: "README.md",
    target: { kind: "page", page: files, resource: active } as const,
  };
  expect(
    resolveTreeListSelection({
      ...input,
      sections: [{ ...input.sections[0]!, nodes: [...input.sections[0]!.nodes, document] }],
      selectedNodeId: undefined,
    }),
  ).toBe("readme");
  const other = { ...active, id: "another-workspace" };
  expect(
    resolveTreeListSelection({
      ...input,
      activeResource: other,
      activeLocation: { ...input.activeLocation, resource: other },
    }),
  ).toBe("workspaces");
});
