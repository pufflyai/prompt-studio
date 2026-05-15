import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "./extension";

describe("worktree extension", () => {
  test("copies repo-local extensions into created worktrees", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-worktree-extension-"));
    const sourceRepo = join(root, "repo");
    const worktree = join(root, "worktree");
    const localExtension = join(sourceRepo, ".pstdio", "extensions", "local-only");

    try {
      mkdirSync(join(localExtension, "node_modules", "generated"), { recursive: true });
      writeFileSync(join(sourceRepo, ".pstdio", "config.json"), JSON.stringify({ project_id: "project-1" }));
      writeFileSync(join(localExtension, "package.json"), JSON.stringify({ name: "local-only" }));
      writeFileSync(join(localExtension, "node_modules", "generated", "artifact.js"), "export default {};");
      const commands: string[][] = [];

      await extension.hooks.postWorktreeCreate.handler(
        {
          process: {
            run: async (input) => {
              commands.push(input.command);
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          },
        } as never,
        { repoPath: sourceRepo, worktreePath: worktree },
      );

      expect(commands).toEqual([
        ["bun", "install"],
        ["bun", "run", "build"],
      ]);
      expect(existsSync(join(worktree, ".pstdio", "extensions", "local-only", "package.json"))).toBe(true);
      expect(existsSync(join(worktree, ".pstdio", "extensions", "local-only", "node_modules"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
