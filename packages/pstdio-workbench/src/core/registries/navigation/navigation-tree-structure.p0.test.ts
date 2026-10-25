import { expect, test } from "bun:test";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

test("navigation structure is available synchronously without reading its contents", async () => {
  const registry = createNavigationTreeRegistry();
  const owner = { kind: "page", id: "ticket", extensionId: "planner" } as const;
  let reads = 0;
  registry.registerContribution({
    id: "ticket-tree",
    idScope: "ticket-tree",
    owner,
    sourceExtensionId: "planner",
    declarationIndex: 0,
    getStructure: ({ resource }) => [{ id: "files", label: resource?.label, nodes: [], loading: true }],
    getSections: async () => {
      reads++;
      return [{ id: "files", label: "Files", nodes: [{ id: "readme", label: "README" }] }];
    },
  });
  const structure = registry.getStructure(owner, "content", {
    resource: { type: "ticket", id: "a", label: "Ticket A" },
  });
  expect(structure).toMatchObject([{ id: "ticket-tree:files", label: "Ticket A", loading: true, nodes: [] }]);
  expect(reads).toBe(0);
  expect(
    registry.getStructure(owner, "content", { resource: { type: "ticket", id: "b", label: "Ticket B" } })[0]?.label,
  ).toBe("Ticket B");
  expect((await registry.getSections(owner))[0]?.nodes[0]?.id).toBe("ticket-tree:readme");
  expect(reads).toBe(1);
});
