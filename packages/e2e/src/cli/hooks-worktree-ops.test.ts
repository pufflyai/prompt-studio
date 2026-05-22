import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitChanges, mergeWorktree, rebaseOntoTarget } from "pstdio-wt";
import { cleanupDirs } from "./helpers";
import {
  createBranchWithCommit,
  createConflictOnMain,
  createRepoForWorktreeOps,
  createWorktreeBranchWithCommit,
  type HookTestContext,
} from "./hooks-infra";
import { TEST_TIMEOUT } from "./timeouts";

const ctx: HookTestContext = { api: null!, dirs: [] };

afterEach(() => {
  cleanupDirs(ctx.dirs);
});

type DispatchHandlers = {
  pre?: Record<
    string,
    (ctx: unknown) => { rejected: boolean; reason?: string } | Promise<{ rejected: boolean; reason?: string }>
  >;
  post?: Record<string, (ctx: unknown) => void | Promise<void>>;
};

const createDispatch = (handlers: DispatchHandlers) => {
  return {
    firePreHook: async (hookName: string, ctx: unknown) => {
      return handlers.pre?.[hookName]?.(ctx) ?? { rejected: false };
    },
    firePostHook: async (hookName: string, ctx: unknown) => {
      await handlers.post?.[hookName]?.(ctx);
    },
  };
};

describe("commit hooks", () => {
  test(
    "pre-commit blocks commit on failure",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      const dispatch = createDispatch({
        pre: { preCommit: () => ({ rejected: true, reason: "lint failed" }) },
      });
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
      let commitSha: string | null = null;
      const dispatch = createDispatch({
        post: {
          postCommit: (ctx) => {
            commitSha = (ctx as { commitSha: string }).commitSha;
          },
        },
      });
      writeFileSync(join(repo, "change.txt"), "new content");

      const result = await commitChanges({ worktreePath: repo, message: "test commit", dispatch });
      expect(result.sha).toBeTruthy();

      expect(commitSha).toBe(result.sha);
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
      const dispatch = createDispatch({
        pre: { preMerge: () => ({ rejected: true }) },
      });

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
      let target: string | null = null;
      const dispatch = createDispatch({
        post: {
          postMerge: (ctx) => {
            target = (ctx as { target: string }).target;
          },
        },
      });
      const targetBranch = execSync("git symbolic-ref --short HEAD", { cwd: repo, encoding: "utf8" }).trim();

      await mergeWorktree({ repoRoot: repo, branch: "feat-merge-post", dispatch });

      expect(target).toBe(targetBranch);
    },
    TEST_TIMEOUT,
  );

  test(
    "merge hooks work when target branch is not named main",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      execSync("git branch -m master", { cwd: repo, stdio: "pipe" });
      createBranchWithCommit(repo, "feat-merge-master", "feat.txt", "feature");
      let target: string | null = null;
      const dispatch = createDispatch({
        post: {
          postMerge: (ctx) => {
            target = (ctx as { target: string }).target;
          },
        },
      });

      await mergeWorktree({ repoRoot: repo, branch: "feat-merge-master", dispatch });

      expect(target).toBe("master");
    },
    TEST_TIMEOUT,
  );

  test(
    "on-conflict fires when merge hits conflicts",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createBranchWithCommit(repo, "feat-merge-conflict", "file.txt", "branch side");
      createConflictOnMain(repo, "file.txt", "main side");

      let conflictHandled = false;
      const dispatch = createDispatch({
        post: {
          onConflict: () => {
            conflictHandled = true;
          },
        },
      });

      const err = await mergeWorktree({ repoRoot: repo, branch: "feat-merge-conflict", squash: true, dispatch }).catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(Error);

      expect(conflictHandled).toBe(true);
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
      const dispatch = createDispatch({
        pre: { preRebase: () => ({ rejected: true }) },
      });

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
      let rebased = false;
      const dispatch = createDispatch({
        post: {
          postRebase: () => {
            rebased = true;
          },
        },
      });

      const result = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-post", dispatch });
      expect(result.rebased).toBe(true);

      expect(rebased).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "on-conflict fires when rebase hits conflicts",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-conflict", "file.txt", "branch side");
      createConflictOnMain(repo, "file.txt", "main side");

      let conflictHandled = false;
      const dispatch = createDispatch({
        post: {
          onConflict: () => {
            conflictHandled = true;
          },
        },
      });

      const err = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-conflict", dispatch }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);

      expect(conflictHandled).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "skips hooks when branch is already up-to-date",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      createWorktreeBranchWithCommit(ctx, repo, "feat-rebase-noop", "feat.txt", "feature");
      let preRebaseRan = false;
      const dispatch = createDispatch({
        pre: {
          preRebase: () => {
            preRebaseRan = true;
            return { rejected: false };
          },
        },
      });

      const result = await rebaseOntoTarget({ repoRoot: repo, branch: "feat-rebase-noop", dispatch });
      expect(result.upToDate).toBe(true);
      expect(existsSync(join(repo, "pre-rebase-noop.txt"))).toBe(false);
      expect(preRebaseRan).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
