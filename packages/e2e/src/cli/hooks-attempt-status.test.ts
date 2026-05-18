import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
import {
  configureAgent,
  createAttemptWithSession,
  createInitializedRepo,
  createRun,
  createRunSafe,
  getAttemptStatusName,
  getProjectId,
  getWorkspace,
  type HookTestContext,
  registerRepo,
  updateSessionStatus,
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

const updateAttemptStatus = async (workspaceId: string, status: string, sessionId?: string) => {
  const body: Record<string, string> = { status };
  if (sessionId) body.session_id = sessionId;

  return fetch(`${api.url}/v1/workspaces/${workspaceId}/attempt-status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
};

describe("attempt-status hooks", () => {
  test(
    "pre-hook receives workspace context",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-worktree-path");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-worktree-path-repo");
      await configureAgent(ctx);

      const outputPath = join(repo, "pre-ctx-check.txt");
      writePlugin(
        repo,
        "ctx-check.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { preAttemptStatusChange(ctx) { if (ctx.toStatus === "review-ready") { writeFileSync(${JSON.stringify(outputPath)}, ctx.workspaceId ?? "missing"); } } } };`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-worktree-path");
      const workspaceId = attempt.workspace.id;

      const res = await updateAttemptStatus(workspaceId, "review-ready");
      expect(res.status).toBe(200);
      expect(await waitForPath(outputPath)).toBe(true);
      expect(readFileSync(outputPath, "utf8")).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-hook rejects transition and leaves status unchanged",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-reject");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-reject-repo");
      await configureAgent(ctx);

      writePlugin(
        repo,
        "reject-guard.ts",
        `export default { hooks: { preAttemptStatusChange(ctx) { if (ctx.toStatus === "review-ready") return { reject: true, reason: "tests failing" }; } } };`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-reject");
      const workspaceId = attempt.workspace.id;

      // Set to running first
      await updateAttemptStatus(workspaceId, "wip");

      // Try to transition to review-ready — pre-hook should block it
      const res = await updateAttemptStatus(workspaceId, "review-ready");

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string; hook_output: string };
      expect(body.hook_output).toContain("tests failing");

      // Verify status is still running
      const ws = await getWorkspace(ctx, projectId, workspaceId);
      const statusName = await getAttemptStatusName(ctx, projectId, ws.attempt_status_id!);
      expect(statusName).toBe("wip");
    },
    TEST_TIMEOUT,
  );

  test(
    "CLI surfaces rejection reason from a review-ready validator plugin",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-cli-plugin-reject");

      writePlugin(
        repo,
        "validator-guard.ts",
        `import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
export default { hooks: { preAttemptStatusChange(ctx) {
  if (ctx.toStatus !== "review-ready") return;
  const worktreePath = ctx.worktreePath ?? ".";
  const filesDir = join(worktreePath, "files");
  if (!existsSync(filesDir)) return { reject: true, reason: "Mock validation failed: missing directory " + filesDir };
  const nonGitkeep = readdirSync(filesDir).filter(f => f !== ".gitkeep");
  if (nonGitkeep.length === 0) return { reject: true, reason: "You should add your poems to the ./files folder" };
} } };`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-cli-plugin-reject");
      mkdirSync(join(attempt.workspace.worktree_path!, "files"), { recursive: true });
      writeFileSync(join(attempt.workspace.worktree_path!, "files", ".gitkeep"), "");

      const runSafe = createRunSafe(ctx);
      const result = runSafe("workspaces set-status --status review-ready", attempt.workspace.worktree_path!);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Pre-hook rejected the transition");
      expect(result.stderr).toContain("You should add your poems to the ./files folder");
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-hook allows transition when plugin returns undefined",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-allow");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-allow-repo");
      await configureAgent(ctx);

      writePlugin(
        repo,
        "allow-guard.ts",
        `export default { hooks: { preAttemptStatusChange() { return undefined; } } };`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-allow");
      const workspaceId = attempt.workspace.id;

      const res = await updateAttemptStatus(workspaceId, "review-ready");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { to_status: string; status_change_id: string };
      expect(body.to_status).toBe("review-ready");
      expect(body.status_change_id).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "transition succeeds when no plugin exists",
    async () => {
      const repo = createInitializedRepo(ctx, "no-hook-transition");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "no-hook-transition-repo");
      await configureAgent(ctx);

      // No plugins written — transition should work
      const { attempt } = await createAttemptWithSession(ctx, repo, "no-hook-transition");
      const workspaceId = attempt.workspace.id;

      const res = await updateAttemptStatus(workspaceId, "review-ready");
      expect(res.status).toBe(200);
    },
    TEST_TIMEOUT,
  );

  test(
    "response includes from_status and to_status",
    async () => {
      const repo = createInitializedRepo(ctx, "from-to-status");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "from-to-status-repo");
      await configureAgent(ctx);

      const { attempt } = await createAttemptWithSession(ctx, repo, "from-to-status");
      const workspaceId = attempt.workspace.id;

      // First transition
      await updateAttemptStatus(workspaceId, "wip");

      // Second transition
      const res = await updateAttemptStatus(workspaceId, "review-ready");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { from_status: string; to_status: string };
      expect(body.from_status).toBe("wip");
      expect(body.to_status).toBe("review-ready");
    },
    TEST_TIMEOUT,
  );

  test(
    "postAttemptStatusChange fires when session ends after CLI set-status",
    async () => {
      const repo = createInitializedRepo(ctx, "post-attempt-session-end");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "post-attempt-session-end-repo");
      await configureAgent(ctx);

      const outputPath = join(repo, "post-attempt-status-review-ready-fired.txt");
      writePlugin(
        repo,
        "post-marker.ts",
        `import { writeFileSync } from "node:fs";
export default { hooks: { postAttemptStatusChange(ctx) { if (ctx.toStatus === "review-ready") writeFileSync(${JSON.stringify(outputPath)}, ctx.sessionId ?? ""); } } };`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "post-attempt-session-end");
      expect(attempt.session).toBeTruthy();
      const run = createRun(ctx);

      run(
        `workspaces set-status --workspace "${attempt.workspace.workspace_shorthand}" --status review-ready --session-id "${attempt.session!.id}"`,
        repo,
      );

      await updateSessionStatus(ctx, attempt.session!.id, "completed");
      expect(await waitForPath(outputPath)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test.skip(
    "surfaces validation details when a pre-hook plugin follows up the active session",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-follow-up-message");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-follow-up-message-repo");
      await configureAgent(ctx);

      writePlugin(
        repo,
        "followup-guard.ts",
        `import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
export default { hooks: { preAttemptStatusChange(ctx) {
  if (ctx.toStatus !== "review-ready") return;
  const worktreePath = ctx.worktreePath ?? ".";
  const filesDir = join(worktreePath, "files");
  if (!existsSync(filesDir)) return { reject: true, reason: "Validation failed. Fix the errors and mark the attempt review-ready again:\\n\\nMock validation failed: missing directory " + filesDir };
  const nonGitkeep = readdirSync(filesDir).filter(f => f !== ".gitkeep");
  if (nonGitkeep.length === 0) return { reject: true, reason: "Validation failed. Fix the errors and mark the attempt review-ready again:\\n\\nYou should add your poems to the ./files folder" };
} } };`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-follow-up-message");
      expect(attempt.session).toBeTruthy();
      mkdirSync(join(attempt.workspace.worktree_path!, "files"), { recursive: true });
      writeFileSync(join(attempt.workspace.worktree_path!, "files", ".gitkeep"), "");

      const sessionUpdate = await updateSessionStatus(ctx, attempt.session!.id, "in_progress");
      expect(sessionUpdate.status).toBe(200);
      const session = (await sessionUpdate.json()) as { status: string };
      expect(session.status).toBe("in_progress");

      const runSafe = createRunSafe(ctx);

      const result = runSafe(
        `workspaces set-status --workspace "${attempt.workspace.workspace_shorthand}" --status review-ready --session-id "${attempt.session!.id}"`,
        repo,
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Validation failed. Fix the errors and mark the attempt review-ready again:");
      expect(result.stderr).toContain("You should add your poems to the ./files folder");
    },
    TEST_TIMEOUT,
  );
});
