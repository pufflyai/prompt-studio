import { describe, expect, test } from "bun:test";
import { resolveCommandWorkspaceDir } from "./execute-extension-command";

const repos = [
  { id: "repo-a", path: "/repo-a" },
  { id: "repo-b", path: "/repo-b" },
];

describe("resolveCommandWorkspaceDir", () => {
  test("uses the worktree path for a worktree-backed workspace", () => {
    expect(resolveCommandWorkspaceDir({ worktreePath: "/wt", repos, repoId: "repo-b" })).toBe("/wt");
  });

  test("mounts the repo the command was invoked for when the root workspace spans many repos", () => {
    // A root workspace + a command from repo B must mount repo B, not the first linked repo.
    expect(resolveCommandWorkspaceDir({ worktreePath: null, repos, repoId: "repo-b" })).toBe("/repo-b");
  });

  test("falls back to the first linked repo when the request carries no repo context", () => {
    expect(resolveCommandWorkspaceDir({ worktreePath: null, repos, repoId: undefined })).toBe("/repo-a");
  });
});
