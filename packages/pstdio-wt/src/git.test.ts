import { describe, expect, test } from "bun:test";
import { GitError, git } from "./git";

describe("git", () => {
  test("runs a git command and returns trimmed stdout", async () => {
    const result = await git(import.meta.dir, ["rev-parse", "--is-inside-work-tree"]);
    expect(result).toBe("true");
  });

  test("throws GitError on failure", async () => {
    try {
      await git("/tmp", ["rev-parse", "--verify", "nonexistent-ref-abc123"]);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GitError);
      expect((err as GitError).exitCode).not.toBe(0);
    }
  });
});
