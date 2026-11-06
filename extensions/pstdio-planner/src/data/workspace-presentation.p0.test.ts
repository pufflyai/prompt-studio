import { expect, test } from "bun:test";
import { workspacePages } from "@pstdio/sdk/extensions";
import { workspacePage } from "./workspace-presentation";

test("workspace links select Files, Changes, overview or personal history from capabilities", () => {
  expect(workspacePage({ id: "project", is_default: true })).toEqual(workspacePages.files);
  expect(
    workspacePage({
      id: "folder",
      provider_capabilities_json: { files: "write", diff: false, merge: false, rebase: false, delete: false },
    }),
  ).toEqual(workspacePages.files);
  expect(workspacePage({ id: "worktree", provider_id: "pstdio.worktree" })).toEqual(workspacePages.workspace);
  expect(workspacePage({ id: "cloud", execution_kind: "remote" })).toEqual(workspacePages.overview);
  expect(workspacePage({ id: "foreign", device: { ownerId: "owner", id: "other", name: "Laptop" } })).toEqual(
    workspacePages.history,
  );
});
