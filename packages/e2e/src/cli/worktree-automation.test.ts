import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo } from "./helpers";
import { createRun, createWorkspaceInRepo, type HookTestContext, waitForPath } from "./hooks-infra";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const ctx: HookTestContext = { api: null!, dirs: [] };

const repoRoot = join(import.meta.dirname, "../../../..");
const worktreeAutomationSource = join(repoRoot, ".pstdio", "extensions", "pstdio-core-worktree-automations");

beforeAll(async () => {
  api = await startApi();
  ctx.api = api;
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(ctx.dirs);
});

const writeBuildablePackage = (repo: string) => {
  writeFileSync(
    join(repo, "package.json"),
    `${JSON.stringify(
      {
        name: "worktree-automation-e2e",
        private: true,
        scripts: {
          build: "bun -e \"await Bun.write('worktree-build-marker.txt', process.cwd())\"",
        },
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  execSync("bun install --lockfile-only", { cwd: repo, stdio: "pipe" });
};

const writeRepoLocalWorktreeExtension = (repo: string) => {
  const target = join(repo, ".pstdio", "extensions", "pstdio-core-worktree-automations");
  mkdirSync(target, { recursive: true });

  for (const file of ["extension.ts", "package.json", "tsconfig.json"]) {
    copyFileSync(join(worktreeAutomationSource, file), join(target, file));
  }
};

const createRepoWithWorktreeAutomation = () => {
  const repo = createGitRepo();
  ctx.dirs.push(repo);

  writeBuildablePackage(repo);
  writeRepoLocalWorktreeExtension(repo);
  execSync("git add -A && git commit -m init", { cwd: repo, stdio: "pipe" });
  createRun(ctx)("projects create worktree-automation-e2e", repo);

  return repo;
};

const readProjectExtensions = async (projectId: string) => {
  const res = await fetch(`${api.url}/v1/projects/${projectId}/extensions`);
  expect(res.ok).toBe(true);
  return (await res.json()) as {
    extensions: Array<{ installName: string; sourcePath: string }>;
  };
};

const readProjectId = (repo: string) => {
  const config = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8"));
  return config.project_id as string;
};

describe("repo-local worktree automation", () => {
  test(
    "bootstraps and builds a worktree in an isolated setup",
    async () => {
      const repo = createRepoWithWorktreeAutomation();
      const projectId = readProjectId(repo);

      const projectExtensions = await readProjectExtensions(projectId);
      const automationExtension = projectExtensions.extensions.find(
        (extension) => extension.installName === "pstdio-core-worktree-automations",
      );
      expect(automationExtension).toBeTruthy();
      expect(realpathSync(automationExtension!.sourcePath)).toBe(
        realpathSync(join(repo, ".pstdio", "extensions", "pstdio-core-worktree-automations")),
      );

      const { workspace } = await createWorkspaceInRepo(ctx, repo);
      expect(workspace.worktree_path).toBeTruthy();

      const worktreePath = workspace.worktree_path!;
      const buildMarkerPath = join(worktreePath, "worktree-build-marker.txt");

      expect(await waitForPath(join(worktreePath, ".pstdio", "config.json"))).toBe(true);
      expect(await waitForPath(buildMarkerPath, 15_000)).toBe(true);
      expect(realpathSync(readFileSync(buildMarkerPath, "utf8"))).toBe(realpathSync(worktreePath));
      expect(existsSync(join(worktreePath, ".pstdio", "tickets"))).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
