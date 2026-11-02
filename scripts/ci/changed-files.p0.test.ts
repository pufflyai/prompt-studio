import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedFiles } from "./changed-files";

test("PR changes include an edited test from an earlier commit and the destination of a rename", () => {
  const root = mkdtempSync(join(tmpdir(), "ci-pr-diff-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture");
  };
  try {
    git("init", "--quiet");
    writeFileSync(join(root, "old.p2.spec.ts"), "old test");
    writeFileSync(join(root, "removed.p1.test.ts"), "removed test");
    commit();
    const base = git("rev-parse", "HEAD");
    git("mv", "old.p2.spec.ts", "renamed.p2.spec.ts");
    git("rm", "removed.p1.test.ts");
    writeFileSync(join(root, "added.p3.bench.ts"), "new benchmark");
    commit();
    writeFileSync(join(root, "README.md"), "later documentation change");
    commit();
    expect(changedFiles(root, base).sort()).toEqual([
      "README.md",
      "added.p3.bench.ts",
      "old.p2.spec.ts",
      "removed.p1.test.ts",
      "renamed.p2.spec.ts",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
