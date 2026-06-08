import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
import { createInitializedRepo, createWorkspaceInRepo, type HookTestContext, waitForPath } from "./hooks-infra";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const ctx: HookTestContext = { api: null!, dirs: [] };

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

const createRepoWithDefaultExtensions = () => {
  return createInitializedRepo(ctx, "worktree-setup-e2e");
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

describe("user-scoped worktree setup", () => {
  test(
    "bootstraps worktree config without copying local ticket files",
    async () => {
      const repo = createRepoWithDefaultExtensions();
      const projectId = readProjectId(repo);

      const projectExtensions = await readProjectExtensions(projectId);
      const extensionsByName = new Map(
        projectExtensions.extensions.map((extension) => [extension.installName, extension]),
      );
      expect(realpathSync(extensionsByName.get("pstdio-worktree-setup")!.sourcePath)).toBe(
        realpathSync(join(api.homePath, "extensions", "pstdio-worktree-setup")),
      );
      expect(realpathSync(extensionsByName.get("pstdio-planner")!.sourcePath)).toBe(
        realpathSync(join(api.homePath, "extensions", "pstdio-planner")),
      );

      const { workspace } = await createWorkspaceInRepo(ctx, repo);
      expect(workspace.worktree_path).toBeTruthy();

      const worktreePath = workspace.worktree_path!;
      expect(await waitForPath(join(worktreePath, ".pstdio", "config.json"))).toBe(true);
      expect(existsSync(join(worktreePath, ".pstdio", "tickets"))).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
