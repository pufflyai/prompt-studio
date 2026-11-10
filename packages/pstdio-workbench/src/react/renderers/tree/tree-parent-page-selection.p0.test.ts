import { expect, test } from "bun:test";
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
