import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
import {
  createInitializedRepo,
  createRun,
  createRunSafe,
  createWorkspaceInRepo,
  type HookTestContext,
  waitForPath,
  writePlugin,
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

describe("custom post-worktree-create hook", () => {
  test(
    "creates files and receives context in worktree",
    async () => {
      const repo = createInitializedRepo(ctx, "custom-hook-env");

      writePlugin(
        repo,
        "post-create-env.ts",
        `
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
export default {
  hooks: {
    postWorktreeCreate(context: any) {
      const dir = join(context.worktreePath, "files");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "env-dump.txt"), [
        "HOOK=postWorktreeCreate",
        "REPO=" + context.repoPath,
        "WORKSPACE=" + context.workspace,
        "TICKET=" + context.ticket,
        "BRANCH=" + context.branch,
        "PROJECT=" + context.projectId,
      ].join("\\n") + "\\n");
    },
  },
};
`,
      );

      const { workspace, ticketShorthand } = await createWorkspaceInRepo(ctx, repo);
      expect(workspace.worktree_path).toBeTruthy();

      const envFile = join(workspace.worktree_path!, "files", "env-dump.txt");
      expect(await waitForPath(envFile)).toBe(true);

      const content = readFileSync(envFile, "utf8");
      const realRepo = realpathSync(repo);
      expect(content).toContain("HOOK=postWorktreeCreate");
      expect(content).toContain(`REPO=${realRepo}`);
      expect(content).toContain(`WORKSPACE=${workspace.workspace_shorthand}`);
      expect(content).toContain(`TICKET=${ticketShorthand}`);
      expect(content).toContain(`BRANCH=workspace/${workspace.workspace_shorthand}`);
      expect(content).not.toContain("PROJECT=\n");
    },
    TEST_TIMEOUT,
  );
});

describe("worktree removal hooks", () => {
  test(
    "pre-worktree-remove blocks workspace deletion on failure",
    async () => {
      const repo = createInitializedRepo(ctx, "preremove-block");
      const { workspace } = await createWorkspaceInRepo(ctx, repo);
      writePlugin(
        repo,
        "pre-remove-block.ts",
        `export default { hooks: { preWorktreeRemove: () => ({ reject: true, reason: "blocked" }) } };`,
      );

      const result = createRunSafe(ctx)(`workspaces delete --id ${workspace.workspace_shorthand}`, repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );

  test(
    "post-worktree-remove runs after workspace deletion",
    async () => {
      const repo = createInitializedRepo(ctx, "postremove-run");
      const { workspace } = await createWorkspaceInRepo(ctx, repo);
      writePlugin(
        repo,
        "post-remove-marker.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postWorktreeRemove() { writeFileSync("${repo}/post-remove-marker.txt", "removed"); } } };
`,
      );

      createRun(ctx)(`workspaces delete --id ${workspace.workspace_shorthand}`, repo);
      expect(await waitForPath(join(repo, "post-remove-marker.txt"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

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
