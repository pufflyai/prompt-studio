import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { changedFiles } from "./changed-files";

const exec = promisify(execFile);

test("PR changes include an edited test from an earlier commit and the destination of a rename", async () => {
  const root = mkdtempSync(join(tmpdir(), "ci-pr-diff-"));
  const git = async (...args: string[]) => (await exec("git", args, { cwd: root, encoding: "utf8" })).stdout.trim();
  const commit = async () => {
    await git("add", ".");
    await git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture");
  };
  try {
    await git("init", "--quiet");
    writeFileSync(join(root, "old.p2.spec.ts"), "old test");
    writeFileSync(join(root, "removed.p1.test.ts"), "removed test");
    await commit();
    const base = await git("rev-parse", "HEAD");
    await git("mv", "old.p2.spec.ts", "renamed.p2.spec.ts");
    await git("rm", "removed.p1.test.ts");
    writeFileSync(join(root, "added.p3.bench.ts"), "new benchmark");
    await commit();
    writeFileSync(join(root, "README.md"), "later documentation change");
    await commit();
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
