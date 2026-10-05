import { expect, test } from "bun:test";
import type { TreeViewSection } from "../../../core";
import { resolveTreeListSelection } from "./tree-list-adapter";

const ticketPage = { kind: "page", extensionId: "author.planner", id: "ticket" } as const;
const workspacePage = { kind: "page", extensionId: "pstdio", id: "workspace" } as const;
const ticket = { type: "ticket", id: "ticket-1" };
const workspace = (id: string) => ({ type: "workspace", id });
const sections = (documentId: string) =>
  [
    {
      id: "ticket-context",
      nodes: [
        ...["body", "first-file", "second-file"].map((id) => ({
          id,
          label: id,
          selected: id === documentId,
          target: { kind: "page" as const, page: ticketPage, resource: { ...ticket, metadata: { documentId: id } } },
        })),
        ...["first", "second"].map((id) => ({
          id,
          label: id,
          resource: workspace(id),
          target: {
            kind: "page" as const,
            page: workspacePage,
            resource: workspace(id),
            parent: { kind: "page" as const, page: ticketPage, resource: ticket },
          },
        })),
      ],
    },
  ] satisfies TreeViewSection[];

test.each([
  "body",
  "first-file",
  "second-file",
])("selects the open workspace over its parent document: %s", (documentId) => {
  for (const id of ["first", "second"]) {
    expect(
      resolveTreeListSelection({
        sections: sections(documentId),
        childrenByNodeId: {},
        activeLocation: { page: workspacePage, resource: workspace(id) },
        activeResource: workspace(id),
        selectedNodeId: id === "first" ? "second" : "first",
      }),
    ).toBe(id);
  }
});

test.each(["body", "first-file", "second-file"])("restores the declared active ticket document: %s", (documentId) => {
  const resource = { ...ticket, metadata: { documentId } };
  expect(
    resolveTreeListSelection({
      sections: sections(documentId),
      childrenByNodeId: {},
      activeLocation: { page: ticketPage, resource },
      activeResource: resource,
      selectedNodeId: "first",
    }),
  ).toBe(documentId);
});

test("ignores a selected parent document when its workspace row is unavailable", () => {
  expect(
    resolveTreeListSelection({
      sections: sections("body"),
      childrenByNodeId: {},
      activeLocation: { page: workspacePage, resource: workspace("other") },
      activeResource: workspace("other"),
    }),
  ).toBeUndefined();
});
