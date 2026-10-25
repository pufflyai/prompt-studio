import { expect, test } from "bun:test";
import { ticketPageTarget } from "./ticket-page-target";

test("Planner targets name each ticket page in the parent chain", () => {
  const parent = { type: "ticket", id: "parent", label: "PS-1" };
  const child = { type: "ticket", id: "child", metadata: { resourceParent: parent, documentId: "notes" } };
  expect(ticketPageTarget(child)).toEqual({
    kind: "page",
    page: { kind: "page", id: "ticket", extensionId: "pstdio.pstdio-planner" },
    resource: child,
    parent: {
      kind: "page",
      page: { kind: "page", id: "ticket", extensionId: "pstdio.pstdio-planner" },
      resource: parent,
      parent: { kind: "page", page: { kind: "page", id: "tickets", extensionId: "pstdio.pstdio-planner" } },
    },
  });
});
