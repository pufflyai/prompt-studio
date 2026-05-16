import { describe, expect, test } from "bun:test";
import { canVirtualizeTreeSections, resolveTreeListActiveNodeId } from "./tree-list-adapter";

describe("resolveTreeListActiveNodeId", () => {
  test("keeps tree selection active when layout active resource uses a different id shape", () => {
    expect(resolveTreeListActiveNodeId("pstdio://sessions/session-1", "session:session-1")).toEqual([
      "pstdio://sessions/session-1",
      "session:session-1",
    ]);
  });

  test("falls back to selected node when there is no active resource", () => {
    expect(resolveTreeListActiveNodeId(undefined, "session:session-1")).toBe("session:session-1");
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
