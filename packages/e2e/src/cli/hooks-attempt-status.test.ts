import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cleanupDirs } from "./helpers";
import {
  configureAgent,
  createAttemptWithSession,
  createInitializedRepo,
  getAttemptStatusName,
  getProjectId,
  getWorkspace,
  type HookTestContext,
  registerRepo,
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
    "pre-hook rejects transition and leaves status unchanged",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-reject");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-reject-repo");
      await configureAgent(ctx);

      writeHook(repo, "pre-attempt-status-review-ready", 'echo "tests failing" >&2; exit 1');

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
    "pre-hook allows transition when it exits zero",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-allow");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-allow-repo");
      await configureAgent(ctx);

      writeHook(repo, "pre-attempt-status-review-ready", "exit 0");

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
    "transition succeeds when no hook script exists",
    async () => {
      const repo = createInitializedRepo(ctx, "no-hook-transition");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "no-hook-transition-repo");
      await configureAgent(ctx);

      // No hooks written — transition should work
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
});
