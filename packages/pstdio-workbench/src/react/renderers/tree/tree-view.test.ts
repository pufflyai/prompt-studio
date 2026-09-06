import { describe, expect, test } from "bun:test";
import { createWorkbenchSelectionResourceMetadata, type ResourceRef } from "../../../core";
import {
  canVirtualizeTreeSections,
  filterTreeListSelection,
  resolveTreeListActiveNodeId,
  resolveTreeListSelection,
} from "./tree-list-adapter";

const ticketsResource = {
  type: "dashboard-view",
  label: "Tickets",
  id: "pstdio://dashboard/tickets",
} satisfies ResourceRef;
const workspacesResource = {
  type: "dashboard-view",
  label: "Workspaces",
  id: "pstdio://dashboard/workspaces",
} satisfies ResourceRef;
describe("resolveTreeListActiveNodeId", () => {
  test("does not keep a stale selected node when an active node is available", () => {
    expect(resolveTreeListActiveNodeId("tickets", "workspaces")).toBe("tickets");
  });
  test("falls back to selected node when there is no active resource", () => {
    expect(resolveTreeListActiveNodeId(undefined, "session:session-1")).toBe("session:session-1");
  });
});
describe("resolveTreeListSelection", () => {
  test("selects a page target when that page is the current location", () => {
    expect(
      resolveTreeListSelection({
        activeLocation: { page: { extensionId: "host", kind: "page", id: "search" } },
        childrenByNodeId: {},
        sections: [
          {
            id: "navigation",
            nodes: [
              {
                id: "search",
                label: "Search",
                target: {
                  kind: "page",
                  page: { extensionId: "host", kind: "page", id: "search" },
                },
              },
            ],
          },
        ],
      }),
    ).toBe("search");
  });
  test("matches active resources by resource uri when the node id has a different shape", () => {
    const session = {
      type: "session",
      label: "Session 1",
      id: "pstdio://sessions/session-1",
    } satisfies ResourceRef;
    expect(
      resolveTreeListSelection({
        activeResource: session,
        childrenByNodeId: {},
        sections: [{ id: "sessions", nodes: [{ id: "session:session-1", label: "Session 1", resource: session }] }],
        selectedNodeId: "session:stale",
      }),
    ).toBe("session:session-1");
  });
  test("selects the active resource row instead of a stale selected resource row", () => {
    expect(
      resolveTreeListSelection({
        activeResource: ticketsResource,
        childrenByNodeId: {},
        sections: [
          {
            id: "navigation",
            nodes: [
              { id: "tickets", label: "Tickets", resource: ticketsResource },
              { id: "workspaces", label: "Workspaces", resource: workspacesResource },
            ],
          },
        ],
        selectedNodeId: "workspaces",
      }),
    ).toBe("tickets");
  });
  test("matches active resources through resource navigation targets", () => {
    expect(
      resolveTreeListSelection({
        activeResource: ticketsResource,
        childrenByNodeId: {},
        sections: [
          {
            id: "navigation",
            nodes: [
              {
                id: "tickets",
                label: "Tickets",
                resource: ticketsResource,
              },
            ],
          },
        ],
        selectedNodeId: "workspaces",
      }),
    ).toBe("tickets");
  });
  test("selects a parent navigation row when the active detail resource provides a selection resource", () => {
    const ticket = {
      type: "ticket",
      label: "PS-1",
      metadata: createWorkbenchSelectionResourceMetadata(ticketsResource),
      id: "pstdio://ticket/PS-1",
    } satisfies ResourceRef;
    expect(
      resolveTreeListSelection({
        activeResource: ticket,
        childrenByNodeId: {},
        sections: [{ id: "navigation", nodes: [{ id: "tickets", label: "Tickets", resource: ticketsResource }] }],
        selectedNodeId: "workspaces",
      }),
    ).toBe("tickets");
  });
  test("clears a stale resource selection when the active resource has no row in the tree", () => {
    const ticket = {
      type: "ticket",
      label: "PS-1",
      id: "pstdio://ticket/PS-1",
    } satisfies ResourceRef;
    expect(
      resolveTreeListSelection({
        activeResource: ticket,
        childrenByNodeId: {},
        sections: [
          {
            id: "navigation",
            nodes: [{ id: "workspaces", label: "Workspaces", resource: workspacesResource }],
          },
        ],
        selectedNodeId: "workspaces",
      }),
    ).toBeUndefined();
  });
  test("keeps explicit non-resource active node ids", () => {
    expect(
      resolveTreeListSelection({
        activeNodeId: "src/index.ts",
        childrenByNodeId: {},
        sections: [{ id: "files", nodes: [{ id: "src/index.ts", label: "index.ts" }] }],
        selectedNodeId: "src/old.ts",
      }),
    ).toBe("src/index.ts");
  });
});
describe("filterTreeListSelection", () => {
  test("keeps the global selection only in the slot that contains it", () => {
    const header = [{ id: "header", nodes: [{ id: "search", label: "Search" }] }];
    const body = [{ id: "body", nodes: [{ id: "sessions", label: "Sessions" }] }];
    expect(filterTreeListSelection(header, {}, "search")).toBe("search");
    expect(filterTreeListSelection(body, {}, "search")).toBeUndefined();
  });
});
describe("canVirtualizeTreeSections", () => {
  test("allows flat tree sections", () => {
    expect(
      canVirtualizeTreeSections([
        { id: "today", nodes: [{ id: "session-1", label: "Session 1" }] },
        { id: "yesterday", nodes: [{ id: "session-2", label: "Session 2" }] },
      ]),
    ).toBe(true);
  });
  test("rejects sections with nested nodes", () => {
    expect(
      canVirtualizeTreeSections([
        {
          id: "workspace",
          nodes: [{ id: "folder", label: "Folder", children: [{ id: "file", label: "File" }] }],
        },
      ]),
    ).toBe(false);
  });
  test("rejects expandable container nodes", () => {
    expect(
      canVirtualizeTreeSections([{ id: "workspace", nodes: [{ id: "folder", label: "Folder", isContainer: true }] }]),
    ).toBe(false);
  });
});
