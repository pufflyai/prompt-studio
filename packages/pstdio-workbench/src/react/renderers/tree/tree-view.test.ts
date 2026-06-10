import { describe, expect, test } from "bun:test";
import { createWorkbenchSelectionResourceMetadata, type ResourceRef } from "../../../core";
import { canVirtualizeTreeSections, resolveTreeListActiveNodeId, resolveTreeListSelection } from "./tree-list-adapter";

const ticketsResource = {
  kind: "dashboard-view",
  uri: "pstdio://dashboard/tickets",
  label: "Tickets",
} satisfies ResourceRef;

const workspacesResource = {
  kind: "dashboard-view",
  uri: "pstdio://dashboard/workspaces",
  label: "Workspaces",
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
  test("matches active resources by resource uri when the node id has a different shape", () => {
    const session = { kind: "session", uri: "pstdio://sessions/session-1", label: "Session 1" } satisfies ResourceRef;

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
                target: { kind: "resource", resource: ticketsResource },
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
      kind: "ticket",
      uri: "pstdio://ticket/PS-1",
      label: "PS-1",
      metadata: createWorkbenchSelectionResourceMetadata(ticketsResource),
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
    const ticket = { kind: "ticket", uri: "pstdio://ticket/PS-1", label: "PS-1" } satisfies ResourceRef;

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
