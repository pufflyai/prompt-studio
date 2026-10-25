import { expect, test } from "bun:test";
import type { ResourceRef, TreeNode } from "../../../core";
import { resolveTreeListSelection } from "./tree-list-adapter";

test("keeps the selected document when its parent row also supplies resource actions", () => {
  const ticket: ResourceRef = { type: "ticket", id: "ticket-1" };
  const page = { extensionId: "planner", kind: "page", id: "ticket" } as const;
  const nodes: TreeNode[] = [
    { id: "ticket", label: "Ticket", resource: ticket },
    {
      id: "notes",
      label: "notes.md",
      target: {
        kind: "page",
        page,
        resource: { type: "ticket", id: "ticket-1", metadata: { documentId: "notes" } },
      },
    },
  ];

  expect(
    resolveTreeListSelection({
      sections: [{ id: "files", nodes }],
      childrenByNodeId: {},
      activeResource: ticket,
      activeLocation: { page, resource: ticket },
      selectedNodeId: "notes",
    }),
  ).toBe("notes");

  expect(
    resolveTreeListSelection({
      sections: [{ id: "files", nodes }],
      childrenByNodeId: {},
      activeResource: ticket,
      activeLocation: { page, resource: ticket },
      selectedNodeId: "ticket",
    }),
  ).toBe("ticket");
});
