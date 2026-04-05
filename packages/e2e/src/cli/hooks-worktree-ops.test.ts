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
  waitForPath,
  writePlugin,
} from "./hooks-infra";
import { TEST_TIMEOUT } from "./timeouts";

const ctx: HookTestContext = { api: null!, dirs: [] };

afterEach(() => {
  cleanupDirs(ctx.dirs);
});

const createDispatchForRepo = async (repo: string) => {
  const { loadPluginRuntime } = await import("pstdio-plugins/hooks");
  const runtime = await loadPluginRuntime({
    repoPath: repo,
    client: {} as never,
  });
  return {
    firePreHook: (hookName: string, ctx: unknown) => runtime.hooks.firePre(hookName as never, ctx as never),
    firePostHook: (hookName: string, ctx: unknown) => runtime.hooks.firePost(hookName as never, ctx as never),
  };
};

describe("commit hooks", () => {
  test(
    "pre-commit blocks commit on failure",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      writePlugin(
        repo,
        "pre-commit-guard.ts",
        `export default { hooks: { preCommit: () => ({ reject: true, reason: "lint failed" }) } };`,
      );
      const dispatch = await createDispatchForRepo(repo);
      writeFileSync(join(repo, "change.txt"), "new content");

      const err = await commitChanges({ worktreePath: repo, message: "should fail", dispatch }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("HOOK preCommit FAILED");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-commit fires after successful commit",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      const markerFile = join(repo, "post-commit-marker.txt");
      writePlugin(
        repo,
        "post-commit-marker.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { postCommit(ctx) { writeFileSync("${markerFile}", ctx.commitSha ?? ""); } } };`,
      );
      const dispatch = await createDispatchForRepo(repo);
      writeFileSync(join(repo, "change.txt"), "new content");

      const result = await commitChanges({ worktreePath: repo, message: "test commit", dispatch });
      expect(result.sha).toBeTruthy();

      expect(await waitForPath(markerFile)).toBe(true);
      const marker = readFileSync(markerFile, "utf8").trim();
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
      writePlugin(repo, "pre-merge-guard.ts", `export default { hooks: { preMerge: () => ({ reject: true }) } };`);
      const dispatch = await createDispatchForRepo(repo);

      const err = await mergeWorktree({ repoRoot: repo, branch: "feat-merge-block", dispatch }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("HOOK preMerge FAILED");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-merge fires after successful merge",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createBranchWithCommit(repo, "feat-merge-post", "feat.txt", "feature");
      const markerFile = join(repo, "post-merge-marker.txt");
      writePlugin(
        repo,
        "post-merge-marker.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { postMerge(ctx) { writeFileSync("${markerFile}", ctx.target ?? ""); } } };`,
      );
      const dispatch = await createDispatchForRepo(repo);
      const targetBranch = execSync("git symbolic-ref --short HEAD", { cwd: repo, encoding: "utf8" }).trim();

      await mergeWorktree({ repoRoot: repo, branch: "feat-merge-post", dispatch });

      expect(await waitForPath(markerFile)).toBe(true);
      const marker = readFileSync(markerFile, "utf8").trim();
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
      const markerFile = join(repo, "post-merge-master-marker.txt");
      writePlugin(
        repo,
        "post-merge-master-marker.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { postMerge(ctx) { writeFileSync("${markerFile}", ctx.target ?? ""); } } };`,
      );
      const dispatch = await createDispatchForRepo(repo);

      await mergeWorktree({ repoRoot: repo, branch: "feat-merge-master", dispatch });

      expect(await waitForPath(markerFile)).toBe(true);
      const marker = readFileSync(markerFile, "utf8").trim();
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

      const markerFile = join(repo, "on-conflict-marker.txt");
      writePlugin(
        repo,
        "on-conflict-merge-marker.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { onConflict(ctx) { writeFileSync("${markerFile}", "conflict"); } } };`,
      );
      const dispatch = await createDispatchForRepo(repo);

      const err = await mergeWorktree({ repoRoot: repo, branch: "feat-merge-conflict", squash: true, dispatch }).catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(Error);

      expect(await waitForPath(markerFile)).toBe(true);
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
      writePlugin(repo, "pre-rebase-guard.ts", `export default { hooks: { preRebase: () => ({ reject: true }) } };`);
      const dispatch = await createDispatchForRepo(repo);

      const err = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-block", dispatch }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("HOOK preRebase FAILED");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-rebase fires after successful rebase",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-post", "feat.txt", "feature");
      createConflictOnMain(repo, "other.txt", "main change");
      const markerFile = join(repo, "post-rebase-marker.txt");
      writePlugin(
        repo,
        "post-rebase-marker.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { postRebase(ctx) { writeFileSync("${markerFile}", "rebased"); } } };`,
      );
      const dispatch = await createDispatchForRepo(repo);

      const result = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-post", dispatch });
      expect(result.rebased).toBe(true);

      expect(await waitForPath(markerFile)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "on-conflict fires when rebase hits conflicts",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-conflict", "file.txt", "branch side");
      createConflictOnMain(repo, "file.txt", "main side");

      const markerFile = join(repo, "on-conflict-rebase-marker.txt");
      writePlugin(
        repo,
        "on-conflict-rebase-marker.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { onConflict(ctx) { writeFileSync("${markerFile}", "conflict"); } } };`,
      );
      const dispatch = await createDispatchForRepo(repo);

      const err = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-conflict", dispatch }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);

      expect(await waitForPath(markerFile)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "skips hooks when branch is already up-to-date",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-noop", "feat.txt", "feature");
      writePlugin(
        repo,
        "pre-rebase-noop-guard.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { preRebase() { writeFileSync("${join(repo, "pre-rebase-noop.txt")}", "should not run"); } } };`,
      );
      const dispatch = await createDispatchForRepo(repo);

      const result = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-noop", dispatch });
      expect(result.upToDate).toBe(true);
      expect(existsSync(join(repo, "pre-rebase-noop.txt"))).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
