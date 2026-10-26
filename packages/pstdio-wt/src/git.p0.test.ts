import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { GitError, git, gitBytes, resolveGitExecutable } from "./git";
import { createTempRepo } from "./test-helpers";

describe("git", () => {
  test("bypasses the Git for Windows cmd launcher", () => {
    const command = resolveGitExecutable({
      exists: (path) => path === "C:\\Program Files\\Git\\mingw64\\bin\\git.exe",
      platform: "win32",
      which: () => "C:\\Program Files\\Git\\cmd\\git.exe",
    });

    expect(command).toBe("C:\\Program Files\\Git\\mingw64\\bin\\git.exe");
  });

  test("reads complete large text and binary Git objects", async () => {
    const repo = await createTempRepo();
    try {
      const text = "A complete line with UTF-8: 🦊\n".repeat(40_000);
      const bytes = Buffer.from([0, 255, 128, 13, 10, 0, 42]);
      await Bun.write(join(repo.dir, "large.txt"), text);
      await Bun.write(join(repo.dir, "binary.bin"), bytes);
      await git(repo.dir, ["add", "."]);
      await git(repo.dir, ["commit", "-m", "add output fixtures"]);

      const [actualText, actualBytes] = await Promise.all([
        git(repo.dir, ["show", "HEAD:large.txt"]),
        gitBytes(repo.dir, ["show", "HEAD:binary.bin"]),
      ]);
      expect(actualText).toBe(text.trim());
      expect(actualBytes).toEqual(bytes);
    } finally {
      await repo.cleanup();
    }
  });

  test("runs a git command and returns trimmed stdout", async () => {
    const result = await git(import.meta.dir, ["rev-parse", "--is-inside-work-tree"]);
    expect(result).toBe("true");
  });

  test("throws GitError on failure", async () => {
    try {
      await git(import.meta.dir, ["rev-parse", "--verify", "nonexistent-ref-abc123"]);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GitError);
      expect((err as GitError).exitCode).not.toBe(0);
    }
  });
});
