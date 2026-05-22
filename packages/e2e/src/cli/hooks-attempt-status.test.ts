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

describe("attempt status transitions", () => {
  test(
    "response includes from_status and to_status",
    async () => {
      const repo = createInitializedRepo(ctx, "from-to-status");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "from-to-status-repo");
      await configureAgent(ctx);

      const { attempt } = await createAttemptWithSession(ctx, repo, "from-to-status");
      await updateAttemptStatus(attempt.workspace.id, "wip");

      const res = await updateAttemptStatus(attempt.workspace.id, "review-ready");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { from_status: string; to_status: string };
      expect(body.from_status).toBe("wip");
      expect(body.to_status).toBe("review-ready");

      const workspace = await getWorkspace(ctx, projectId, attempt.workspace.id);
      const statusName = await getAttemptStatusName(ctx, projectId, workspace.attempt_status_id!);
      expect(statusName).toBe("review-ready");
    },
    TEST_TIMEOUT,
  );
});
