import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { copyIgnored } from "./copy-ignored";
import { git } from "./git";
import { createTempRepo } from "./test-helpers";
import { createWorktree } from "./worktree";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

describe("copyIgnored", () => {
  test("copies gitignored directories to target worktree", async () => {
    // set up .gitignore
    await writeFile(join(repo.dir, ".gitignore"), "node_modules/\n");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "add gitignore"]);

    // create node_modules in source
    await mkdir(join(repo.dir, "node_modules", ".cache"), { recursive: true });
    await writeFile(join(repo.dir, "node_modules", "pkg.json"), '{"name":"test"}');
    await writeFile(join(repo.dir, "node_modules", ".cache", "data"), "cached");

    // create worktree
    const wtPath = join(repo.dir, "wt-copy");
    await createWorktree({ repoRoot: repo.dir, branch: "task/copy", path: wtPath });

    const result = await copyIgnored({
      source: repo.dir,
      target: wtPath,
    });

    expect(result.copied.length).toBeGreaterThan(0);
    expect(existsSync(join(wtPath, "node_modules", "pkg.json"))).toBe(true);
    expect(existsSync(join(wtPath, "node_modules", ".cache", "data"))).toBe(true);
  });

  test("skips when source has no ignored files", async () => {
    const wtPath = join(repo.dir, "wt-copy");
    await createWorktree({ repoRoot: repo.dir, branch: "task/no-ignored", path: wtPath });

    const result = await copyIgnored({
      source: repo.dir,
      target: wtPath,
    });

    expect(result.copied).toEqual([]);
  });

  test("copies only specified patterns when provided", async () => {
    await writeFile(join(repo.dir, ".gitignore"), "node_modules/\nbuild/\n");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "add gitignore"]);

    await mkdir(join(repo.dir, "node_modules"), { recursive: true });
    await writeFile(join(repo.dir, "node_modules", "index.js"), "module");
    await mkdir(join(repo.dir, "build"), { recursive: true });
    await writeFile(join(repo.dir, "build", "out.js"), "built");

    const wtPath = join(repo.dir, "wt-copy");
    await createWorktree({ repoRoot: repo.dir, branch: "task/filter", path: wtPath });

    await copyIgnored({
      source: repo.dir,
      target: wtPath,
      patterns: ["node_modules"],
    });

    expect(existsSync(join(wtPath, "node_modules", "index.js"))).toBe(true);
    expect(existsSync(join(wtPath, "build", "out.js"))).toBe(false);
  });
});
