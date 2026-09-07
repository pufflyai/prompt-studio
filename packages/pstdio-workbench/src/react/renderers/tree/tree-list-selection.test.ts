import { expect, test } from "bun:test";
import type { TreeViewSection } from "../../../core";
import { resolveTreeListSelection } from "./tree-list-adapter";

test.each(["body", "first-file", "second-file"])("selects only the declared ticket document: %s", (documentId) => {
  const page = { kind: "page", extensionId: "author.planner", id: "ticket" } as const;
  const resource = { type: "ticket", id: "ticket-1", metadata: { documentId } };
  const nodes = ["body", "first-file", "second-file"].map((id) => ({
    id,
    label: id,
    target: { kind: "page" as const, page, resource: { ...resource, metadata: { documentId: id } } },
  }));
  const sections: TreeViewSection[] = [{ id: "documents", nodes }];

  expect(
    resolveTreeListSelection({
      sections,
      childrenByNodeId: {},
      activeLocation: { page, resource },
      activeResource: resource,
      selectedNodeId: documentId,
    }),
  ).toBe(documentId);
});
