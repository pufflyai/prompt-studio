import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
import {
  createInitializedRepo,
  createRun,
  createWorkspaceInRepo,
  type HookTestContext,
  waitForPath,
} from "./hooks-infra";
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

describe("default post-worktree-create hook", () => {
  test(
    "copies .pstdio/config.json into worktree on workspace creation",
    async () => {
      const repo = createInitializedRepo(ctx, "hook-copies-config");

      const { workspace } = await createWorkspaceInRepo(ctx, repo);
      expect(workspace.worktree_path).toBeTruthy();

      expect(await waitForPath(join(workspace.worktree_path!, ".pstdio", "config.json"))).toBe(true);
    },
    TEST_TIMEOUT,
  );
});

describe("worktree removal hooks", () => {
  test(
    "operations succeed normally without hook files",
    async () => {
      const repo = createInitializedRepo(ctx, "noop-delete");
      const { workspace } = await createWorkspaceInRepo(ctx, repo);
      createRun(ctx)(`workspaces delete --id ${workspace.workspace_shorthand}`, repo);
    },
    TEST_TIMEOUT,
  );
});
