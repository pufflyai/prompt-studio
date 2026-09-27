import { expect, test } from "bun:test";
import { resolveLegacyWorkspaceLocation } from "./workspace-location-migration";

test("keeps recorded locations and otherwise chooses the first linked folder deterministically", () => {
  const folders = [
    { id: "b", path: "/second", created_at: "2026-01-01", link_id: "b" },
    { id: "a", path: "/first", created_at: "2026-01-01", link_id: "a" },
  ];
  expect(resolveLegacyWorkspaceLocation({ worktree_path: null, provider_id: "pstdio.root" }, folders).rootPath).toBe(
    "/first",
  );
  expect(
    resolveLegacyWorkspaceLocation({ worktree_path: "/chosen", provider_id: "pstdio.root" }, folders).rootPath,
  ).toBe("/chosen");
  expect(resolveLegacyWorkspaceLocation({ worktree_path: null, provider_id: "pstdio.root" }, []).rootPath).toBeNull();
});

test("preserves other repository workspaces and never invents remote local paths", () => {
  const folders = [
    { id: "a", path: "/first", created_at: "1", link_id: "a" },
    { id: "b", path: "/second", created_at: "2", link_id: "b" },
  ];
  const result = resolveLegacyWorkspaceLocation(
    {
      worktree_path: "/isolated",
      provider_id: "pstdio.worktree",
      provider_ref_json: { version: 1, data: { repo_id: "b" } },
    },
    folders,
  );
  expect(result.rootPath).toBe("/isolated");
  expect(result.providerRef?.data).toEqual({ sourceRoot: "/second", worktreeRoot: "/isolated", relativePath: "" });
  expect(
    resolveLegacyWorkspaceLocation(
      {
        worktree_path: null,
        execution_kind: "remote",
        provider_id: "cloud",
        provider_ref_json: { version: 1, data: { id: "remote" } },
      },
      folders,
    ),
  ).toEqual({ rootPath: null, providerRef: { version: 1, data: { id: "remote" } } });
});

test("does not turn a removed Git worktree into its source checkout", () => {
  const folders = [{ id: "repo", path: "/source", created_at: "1", link_id: "link" }];
  const location = resolveLegacyWorkspaceLocation(
    {
      worktree_path: null,
      provider_id: "pstdio.worktree",
      provider_ref_json: { version: 1, data: { repo_id: "repo" } },
    },
    folders,
  );
  expect(location.rootPath).toBeNull();
  expect(location.providerRef).toBeNull();
});
