import { describe, expect, test } from "bun:test";
import { beginWorkspaceFileLoad } from "./workspace-child-widget-state";

describe("beginWorkspaceFileLoad", () => {
  test("clears files when the next workspace has no filesystem path", () => {
    expect(
      beginWorkspaceFileLoad(undefined, {
        entries: [{ name: "README.md", path: "/previous/README.md", isDirectory: false }],
        failed: true,
        loading: true,
      }),
    ).toEqual({ entries: [], failed: false, loading: false });
  });
});
