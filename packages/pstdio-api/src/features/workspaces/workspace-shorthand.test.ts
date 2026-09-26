import { describe, expect, test } from "bun:test";
import { setupWorkspaceWorktree } from "./worktree-setup";

const invalidShorthands = [
  "../outside",
  "foo/../../outside",
  "foo\\outside",
  ".",
  "..",
  "bad name",
  "bad~ref",
  "bad:ref",
];

describe("workspace shorthand identifiers", () => {
  test.each(invalidShorthands)("rejects unsafe worktree identifier %s before accessing Git", async (shorthand) => {
    await expect(
      setupWorkspaceWorktree({ repoPath: "/missing-repository", workspaceShorthand: shorthand, base: "HEAD" }),
    ).rejects.toThrow("Workspace shorthand");
  });
});
