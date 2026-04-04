import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo } from "./helpers";
import {
  createInitializedRepo,
  createRun,
  createRunSafe,
  createWorkspaceInRepo,
  getProjectId,
  type HookTestContext,
  waitForPath,
  writeHook,
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

describe("hooks CLI", () => {
  test(
    "lists all hook types with installed status",
    () => {
      const repo = createInitializedRepo(ctx, "hooks-list");
      writeHook(repo, "pre-commit", "exit 0");
      writeHook(repo, "post-worktree-create", "echo hi");

      const output = createRun(ctx)("hooks list", repo);

      // worktree hooks
      expect(output).toContain("pre-worktree-create");
      expect(output).toContain("post-worktree-create");
      expect(output).toContain("on-conflict");
      // session hooks
      expect(output).toContain("post-session-start");
      expect(output).toContain("post-session-success");
      expect(output).toContain("post-session-fail");
      expect(output).toContain("post-session-resume");
      expect(output).toContain("post-session-await-input");
      // ticket hooks
      expect(output).toContain("pre-ticket-creation");
      expect(output).toContain("post-ticket-creation");
      expect(output).toContain("pre-ticket-status-change");
      expect(output).toContain("post-ticket-status-change");
      expect(output).toContain("pre-ticket-archive");
      expect(output).toContain("post-ticket-archive");
      expect(output).toContain("pre-ticket-deletion");
      expect(output).toContain("post-ticket-deletion");
    },
    TEST_TIMEOUT,
  );

  test(
    "creates a hook file using bundled scaffold",
    () => {
      const repo = createGitRepo();
      ctx.dirs.push(repo);

      const output = createRun(ctx)("hooks create post-worktree-create", repo);
      const hookPath = join(repo, ".pstdio", "hooks", "post-worktree-create");
      const content = readFileSync(hookPath, "utf8");

      expect(output).toContain('Created hook "post-worktree-create"');
      expect(content).toContain("pstdio tickets pull");
      expect(createRun(ctx)("hooks list", repo)).toContain("post-worktree-create          yes");
    },
    TEST_TIMEOUT,
  );

  test(
    "runs a hook manually and shows output",
    () => {
      const repo = createInitializedRepo(ctx, "hooks-run");
      writeHook(repo, "pre-commit", 'echo "manual hook output"');

      const output = createRun(ctx)("hooks run pre-commit", repo);
      expect(output).toContain("manual hook output");
    },
    TEST_TIMEOUT,
  );

  test(
    "reports missing hook",
    () => {
      const repo = createInitializedRepo(ctx, "hooks-run-missing");
      const output = createRun(ctx)("hooks run pre-commit", repo);
      expect(output).toContain("No hook script found");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails on non-zero exit",
    () => {
      const repo = createInitializedRepo(ctx, "hooks-run-fail");
      writeHook(repo, "pre-commit", "exit 1");

      const result = createRunSafe(ctx)("hooks run pre-commit", repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );

  test(
    "passes PSTDIO_HOOK env var to hook",
    () => {
      const repo = createInitializedRepo(ctx, "hooks-env");
      writeHook(repo, "pre-commit", 'echo "$PSTDIO_HOOK"');

      const output = createRun(ctx)("hooks run pre-commit", repo);
      expect(output).toContain("pre-commit");
    },
    TEST_TIMEOUT,
  );

  test(
    "can run ticket and worktree hooks manually",
    () => {
      const repo = createInitializedRepo(ctx, "hooks-run-types");
      writeHook(repo, "pre-ticket-creation", 'echo "ticket hook"');
      writeHook(repo, "post-worktree-create", 'echo "worktree hook"');

      expect(createRun(ctx)("hooks run pre-ticket-creation", repo)).toContain("ticket hook");
      expect(createRun(ctx)("hooks run post-worktree-create", repo)).toContain("worktree hook");
    },
    TEST_TIMEOUT,
  );
});

describe("hook CRUD via API", () => {
  test(
    "creates, reads, updates, and deletes a hook via API",
    async () => {
      const repo = createInitializedRepo(ctx, "hook-crud-api");
      const projectId = getProjectId(repo);

      const putRes = await fetch(`${api.url}/v1/projects/${projectId}/hooks/pre-merge`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "bun run test" }),
      });
      expect(putRes.status).toBe(204);
      expect(existsSync(join(repo, ".pstdio", "hooks", "pre-merge"))).toBe(true);
      expect(readFileSync(join(repo, ".pstdio", "hooks", "pre-merge"), "utf8")).toBe("bun run test");

      const listRes = await fetch(`${api.url}/v1/projects/${projectId}/hooks`);
      const hooks = (await listRes.json()) as Array<{ name: string; content: string | null }>;
      expect(hooks.find((h) => h.name === "pre-merge")?.content).toBe("bun run test");

      await fetch(`${api.url}/v1/projects/${projectId}/hooks/pre-merge`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "bun run test && bun run build" }),
      });
      expect(readFileSync(join(repo, ".pstdio", "hooks", "pre-merge"), "utf8")).toBe("bun run test && bun run build");

      const delRes = await fetch(`${api.url}/v1/projects/${projectId}/hooks/pre-merge`, { method: "DELETE" });
      expect(delRes.status).toBe(204);
      expect(existsSync(join(repo, ".pstdio", "hooks", "pre-merge"))).toBe(false);
    },
    TEST_TIMEOUT,
  );
});

describe("default post-worktree-create hook", () => {
  test(
    "project init scaffolds default post-worktree-create hook",
    () => {
      const repo = createInitializedRepo(ctx, "scaffold-hooks");
      const hookPath = join(repo, ".pstdio", "hooks", "post-worktree-create");

      expect(existsSync(hookPath)).toBe(true);
      const content = readFileSync(hookPath, "utf8");
      expect(content).toContain("config.json");
      expect(content).toContain("pstdio tickets pull");
    },
    TEST_TIMEOUT,
  );

  test(
    "copies config and agent folders into worktree",
    async () => {
      const repo = createInitializedRepo(ctx, "hook-copies-config");
      mkdirSync(join(repo, ".claude", "skills", "custom-skill"), { recursive: true });
      writeFileSync(join(repo, ".claude", "skills", "custom-skill", "SKILL.md"), "# custom");
      mkdirSync(join(repo, ".opencode", "skills", "custom-skill"), { recursive: true });
      writeFileSync(join(repo, ".opencode", "skills", "custom-skill", "SKILL.md"), "# custom");

      const { workspace } = await createWorkspaceInRepo(ctx, repo);
      expect(workspace.worktree_path).toBeTruthy();

      expect(await waitForPath(join(workspace.worktree_path!, ".pstdio", "config.json"))).toBe(true);
      expect(await waitForPath(join(workspace.worktree_path!, ".claude", "skills", "custom-skill", "SKILL.md"))).toBe(
        true,
      );
      expect(await waitForPath(join(workspace.worktree_path!, ".opencode", "skills", "custom-skill", "SKILL.md"))).toBe(
        true,
      );
    },
    TEST_TIMEOUT,
  );
});

describe("custom post-worktree-create hook", () => {
  test(
    "creates files and receives all env vars in worktree",
    async () => {
      const repo = createInitializedRepo(ctx, "custom-hook-env");

      writeHook(
        repo,
        "post-worktree-create",
        `
mkdir -p "$PSTDIO_WORKTREE_PATH/files"
cat > "$PSTDIO_WORKTREE_PATH/files/env-dump.txt" <<EOF
HOOK=$PSTDIO_HOOK
REPO=$PSTDIO_REPO_PATH
WORKSPACE=$PSTDIO_WORKSPACE
TICKET=$PSTDIO_TICKET
BRANCH=$PSTDIO_BRANCH
PROJECT=$PSTDIO_PROJECT_ID
CWD=$(pwd)
EOF
`,
      );

      const { workspace, ticketShorthand } = await createWorkspaceInRepo(ctx, repo);
      expect(workspace.worktree_path).toBeTruthy();

      const envFile = join(workspace.worktree_path!, "files", "env-dump.txt");
      expect(await waitForPath(envFile)).toBe(true);

      const content = readFileSync(envFile, "utf8");
      const realRepo = realpathSync(repo);
      expect(content).toContain("HOOK=post-worktree-create");
      expect(content).toContain(`REPO=${realRepo}`);
      expect(content).toContain(`WORKSPACE=${workspace.workspace_shorthand}`);
      expect(content).toContain(`TICKET=${ticketShorthand}`);
      expect(content).toContain(`BRANCH=workspace/${workspace.workspace_shorthand}`);
      expect(content).not.toContain("PROJECT=\n");
      // cwd should be the worktree
      const cwdLine = content.split("\n").find((l) => l.startsWith("CWD="))!;
      expect(realpathSync(cwdLine.replace("CWD=", ""))).toBe(realpathSync(workspace.worktree_path!));
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
      writeHook(repo, "pre-worktree-remove", "exit 1");

      const result = createRunSafe(ctx)(`workspaces delete --id ${workspace.workspace_shorthand}`, repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("HOOK pre-worktree-remove FAILED");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-worktree-remove runs after workspace deletion",
    async () => {
      const repo = createInitializedRepo(ctx, "postremove-run");
      const { workspace } = await createWorkspaceInRepo(ctx, repo);
      writeHook(repo, "post-worktree-remove", `echo "removed" > "${repo}/post-remove-marker.txt"`);

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
