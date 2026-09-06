import { expect, test } from "bun:test";
import type { ResourceRef, TreeNode } from "../../../core";
import { resolveTreeListSelection } from "./tree-list-adapter";

test("keeps the selected document when its parent row also supplies resource actions", () => {
  const ticket: ResourceRef = { kind: "ticket", id: "ticket-1", uri: "pstdio://ticket/ticket-1" };
  const nodes: TreeNode[] = [
    { id: "ticket", label: "Ticket", resource: ticket },
    {
      id: "notes",
      label: "notes.md",
      target: {
        kind: "page",
        page: { extensionId: "planner", kind: "page", id: "ticket" },
        resource: { type: "ticket", id: "ticket-1", metadata: { documentId: "notes" } },
      },
    },
  ];

  expect(
    resolveTreeListSelection({
      sections: [{ id: "files", nodes }],
      childrenByNodeId: {},
      activeResource: ticket,
      selectedNodeId: "notes",
    }),
  ).toBe("notes");

  expect(
    resolveTreeListSelection({
      sections: [{ id: "files", nodes }],
      childrenByNodeId: {},
      activeResource: ticket,
      selectedNodeId: "ticket",
    }),
  ).toBe("ticket");
});
