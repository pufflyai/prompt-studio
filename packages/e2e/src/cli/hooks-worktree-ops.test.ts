import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitChanges, mergeWorktree, rebaseOntoTarget } from "pstdio-wt";
import { cleanupDirs } from "./helpers";
import {
  createBranchWithCommit,
  createConflictOnMain,
  createRepoForWorktreeOps,
  createWorktreeBranchWithCommit,
  type HookTestContext,
  wait,
  writeHook,
} from "./hooks-infra";
import { TEST_TIMEOUT } from "./timeouts";

const ctx: HookTestContext = { api: null!, dirs: [] };

afterEach(() => {
  cleanupDirs(ctx.dirs);
});

describe("commit hooks", () => {
  test(
    "pre-commit blocks commit on failure",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      writeHook(repo, "pre-commit", 'echo "lint failed" >&2; exit 1');
      writeFileSync(join(repo, "change.txt"), "new content");

      const err = await commitChanges({ worktreePath: repo, message: "should fail" }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("HOOK pre-commit FAILED");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-commit fires after successful commit",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      writeHook(repo, "post-commit", `echo "$PSTDIO_COMMIT_SHA" > "${repo}/post-commit-marker.txt"`);
      writeFileSync(join(repo, "change.txt"), "new content");

      const result = await commitChanges({ worktreePath: repo, message: "test commit" });
      expect(result.sha).toBeTruthy();

      // post-commit is fire-and-forget — give it time
      await wait(500);
      expect(existsSync(join(repo, "post-commit-marker.txt"))).toBe(true);
      const marker = readFileSync(join(repo, "post-commit-marker.txt"), "utf8").trim();
      expect(marker).toBe(result.sha);
    },
    TEST_TIMEOUT,
  );

  test(
    "commit succeeds without hook files",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      writeFileSync(join(repo, "change.txt"), "content");

      const result = await commitChanges({ worktreePath: repo, message: "no hooks" });
      expect(result.sha).toBeTruthy();
    },
    TEST_TIMEOUT,
  );
});

describe("merge hooks", () => {
  test(
    "pre-merge blocks merge on failure",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createBranchWithCommit(repo, "feat-merge-block", "feat.txt", "feature");
      writeHook(repo, "pre-merge", "exit 1");

      const err = await mergeWorktree({ repoRoot: repo, branch: "feat-merge-block" }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("HOOK pre-merge FAILED");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-merge fires after successful merge",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createBranchWithCommit(repo, "feat-merge-post", "feat.txt", "feature");
      writeHook(repo, "post-merge", `echo "$PSTDIO_TARGET" > "${repo}/post-merge-marker.txt"`);
      const targetBranch = execSync("git symbolic-ref --short HEAD", { cwd: repo, encoding: "utf8" }).trim();

      await mergeWorktree({ repoRoot: repo, branch: "feat-merge-post" });

      await wait(500);
      expect(existsSync(join(repo, "post-merge-marker.txt"))).toBe(true);
      const marker = readFileSync(join(repo, "post-merge-marker.txt"), "utf8").trim();
      expect(marker).toBe(targetBranch);
    },
    TEST_TIMEOUT,
  );

  test(
    "merge hooks work when target branch is not named main",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      execSync("git branch -m master", { cwd: repo, stdio: "pipe" });
      createBranchWithCommit(repo, "feat-merge-master", "feat.txt", "feature");
      writeHook(repo, "post-merge", `echo "$PSTDIO_TARGET" > "${repo}/post-merge-master-marker.txt"`);

      await mergeWorktree({ repoRoot: repo, branch: "feat-merge-master" });

      await wait(500);
      expect(existsSync(join(repo, "post-merge-master-marker.txt"))).toBe(true);
      const marker = readFileSync(join(repo, "post-merge-master-marker.txt"), "utf8").trim();
      expect(marker).toBe("master");
    },
    TEST_TIMEOUT,
  );

  test(
    "on-conflict fires when merge hits conflicts",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createBranchWithCommit(repo, "feat-merge-conflict", "file.txt", "branch side");
      createConflictOnMain(repo, "file.txt", "main side");

      writeHook(repo, "on-conflict", `echo "conflict" > "${repo}/on-conflict-marker.txt"`);

      const err = await mergeWorktree({ repoRoot: repo, branch: "feat-merge-conflict", squash: true }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);

      await wait(500);
      expect(existsSync(join(repo, "on-conflict-marker.txt"))).toBe(true);
    },
    TEST_TIMEOUT,
  );
});

describe("rebase hooks", () => {
  test(
    "pre-rebase blocks rebase on failure",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-block", "feat.txt", "feature");
      createConflictOnMain(repo, "other.txt", "main change");
      writeHook(repo, "pre-rebase", "exit 1");

      const err = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-block" }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("HOOK pre-rebase FAILED");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-rebase fires after successful rebase",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-post", "feat.txt", "feature");
      createConflictOnMain(repo, "other.txt", "main change");
      writeHook(repo, "post-rebase", `echo "rebased" > "${repo}/post-rebase-marker.txt"`);

      const result = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-post" });
      expect(result.rebased).toBe(true);

      await wait(500);
      expect(existsSync(join(repo, "post-rebase-marker.txt"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "on-conflict fires when rebase hits conflicts",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-conflict", "file.txt", "branch side");
      createConflictOnMain(repo, "file.txt", "main side");

      writeHook(repo, "on-conflict", `echo "conflict" > "${repo}/on-conflict-rebase-marker.txt"`);

      const err = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-conflict" }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);

      await wait(500);
      expect(existsSync(join(repo, "on-conflict-rebase-marker.txt"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "skips hooks when branch is already up-to-date",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-noop", "feat.txt", "feature");
      writeHook(repo, "pre-rebase", `echo "should not run" > "${repo}/pre-rebase-noop.txt"`);

      const result = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-noop" });
      expect(result.upToDate).toBe(true);
      expect(existsSync(join(repo, "pre-rebase-noop.txt"))).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
