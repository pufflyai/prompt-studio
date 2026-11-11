import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createLocalReviewPlan } from "./local-review-plan";
import { discoverTestFiles } from "./test-discovery";
import { readWorkspacePackages } from "./workspace-packages";

export const readReviewSource = (root: string, base: string, additionalTests: string[] = []) => {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 10000 });
  const head = git("rev-parse", "HEAD").trim();
  const mergeBase = git("merge-base", base, head).trim();
  const changed = git("diff", "--name-only", "--no-renames", "-z", mergeBase, head).split("\0").filter(Boolean);
  const dirty = git("status", "--porcelain", "--untracked-files=normal").trim();
  const packages = readWorkspacePackages(root).map((pkg) => ({
    ...pkg,
    scripts: JSON.parse(readFileSync(join(root, pkg.dir, "package.json"), "utf8")).scripts ?? {},
  }));
  return {
    head,
    mergeBase,
    dirty,
    plan: createLocalReviewPlan({ packages, tests: discoverTestFiles(root), changed, additionalTests }),
  };
};

// Ignore runtime configuration inherited from the agent's live Prompt Studio session.
// This environment belongs to disposable validation processes, never the editing shell.
export const localReviewEnvironment = (root: string, env: NodeJS.ProcessEnv = process.env) => {
  const isolated: NodeJS.ProcessEnv = {
    ...Object.fromEntries(
      Object.entries(env).map(([key, value]) => [
        key,
        /^(PSTDIO_|E2E_|CI$|CI_|GITHUB_|GIT_|TEST_PRIORITIES$|BUN_TEST_|API_TEST_|MANAGER_TEST_|SYNC_TEST_|RELAY_TEST_|COMPOSE_PROJECT_NAME$|NX_)/.test(
          key,
        )
          ? undefined
          : value,
      ]),
    ),
    PSTDIO_LOCAL_REVIEW_COMPOSE_MANIFEST: join(root, "compose-projects.jsonl"),
    PSTDIO_HOME: join(root, "runtime-home"),
    BUN_INSTALL_CACHE_DIR: join(root, "bun-cache"),
    NX_DAEMON: "false",
    NX_PARALLEL: "1",
  };
  return isolated;
};
