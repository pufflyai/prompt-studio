import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mergeWorktree, rebaseOntoTarget } from "pstdio-wt";
import { cleanupDirs } from "./helpers";
import {
  createBranchWithCommit,
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

describe("merge hooks", () => {
  test(
    "merge hooks work when target branch is not named main",
    async () => {
      const repo = createRepoForWorktreeOps(ctx);
      execSync("git branch -m master", { cwd: repo, stdio: "pipe" });
      createBranchWithCommit(repo, "feat-merge-master", "feat.txt", "feature");
      let target = null as string | null;
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
});

describe("rebase hooks", () => {
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
      expect(preRebaseRan).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
