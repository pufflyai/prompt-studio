import { expect, test } from "bun:test";
import { buildWorkspaceRecord } from "./workspace-record";

test("a default local workspace owns its folder without Git capabilities", () => {
  const workspace = buildWorkspaceRecord({
    project_id: "project",
    shorthand: "default",
    is_default: true,
    root_path: "/notes",
  });
  expect(workspace.root_path).toBe("/notes");
  expect(workspace.provider_id).toBe("pstdio.root");
  expect(workspace.provider_capabilities_json).toEqual({
    files: "write",
    diff: false,
    merge: false,
    rebase: false,
    archive: false,
    delete: false,
  });
});
