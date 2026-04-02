import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, PSTDIO_CLI } from "./helpers";
import {
  createAttemptWithSession,
  createInitializedRepo,
  getAttemptStatusName,
  getProjectId,
  getStatusId,
  getStatusName,
  getWorkspace,
  type HookTestContext,
  registerRepo,
  updateSessionStatus,
  wait,
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

// Builds a shell preamble that lets hooks call the pstdio CLI against the test API
const cliPreamble = () =>
  `export PSTDIO_API_URL="${api.url}"
export PSTDIO_DISABLE_API_AUTO_START=1
PSTDIO="bun run ${PSTDIO_CLI}"`;

describe("post-session-start moves ticket to wip", () => {
  test(
    "hook changes ticket status and workspace attempt status on session start",
    async () => {
      const repo = createInitializedRepo(ctx, "combo-session-wip");

      writeHook(repo, "post-worktree-create", `mkdir -p "$PSTDIO_WORKTREE_PATH/files"`);

      writeHook(
        repo,
        "post-session-start",
        `${cliPreamble()}
$PSTDIO tickets update --id "$PSTDIO_TICKET" --status wip
$PSTDIO workspaces set-status --workspace "$PSTDIO_WORKSPACE" --status wip
`,
      );

      const { attempt, attemptRes, projectId } = await createAttemptWithSession(ctx, repo, "combo-session-wip-repo");
      expect(attemptRes.status).toBe(201);
      await wait(3000);

      // Verify ticket moved to wip
      const tickets = (await (
        await fetch(`${api.url}/v1/tickets?project_id=${encodeURIComponent(projectId)}`)
      ).json()) as Array<{ id: string; status_id: string | null }>;
      const statusName = tickets[0].status_id ? await getStatusName(ctx, projectId, tickets[0].status_id) : null;
      expect(statusName).toBe("wip");

      // Verify workspace attempt status is wip
      const ws = await getWorkspace(ctx, projectId, attempt.workspace.id);
      const wsStatus = ws.attempt_status_id ? await getAttemptStatusName(ctx, projectId, ws.attempt_status_id) : null;
      expect(wsStatus).toBe("wip");
    },
    TEST_TIMEOUT,
  );
});

describe("post-session-success branches on session outcome", () => {
  test(
    "moves ticket to done when session completes",
    async () => {
      const repo = createInitializedRepo(ctx, "combo-success-done");

      writeHook(repo, "post-worktree-create", `mkdir -p "$PSTDIO_WORKTREE_PATH/files"`);

      writeHook(
        repo,
        "post-session-success",
        `${cliPreamble()}
$PSTDIO tickets update --id "$PSTDIO_TICKET" --status done
$PSTDIO workspaces set-status --workspace "$PSTDIO_WORKSPACE" --status reviewed
`,
      );

      const { attempt, projectId } = await createAttemptWithSession(ctx, repo, "combo-success-done-repo");
      expect(attempt.session).toBeTruthy();
      await wait(2000);

      await updateSessionStatus(ctx, attempt.session!.id, "completed");
      await wait(3000);

      const tickets = (await (
        await fetch(`${api.url}/v1/tickets?project_id=${encodeURIComponent(projectId)}`)
      ).json()) as Array<{ id: string; status_id: string | null }>;
      const statusName = tickets[0].status_id ? await getStatusName(ctx, projectId, tickets[0].status_id) : null;
      expect(statusName).toBe("done");

      const ws = await getWorkspace(ctx, projectId, attempt.workspace.id);
      const wsStatus = ws.attempt_status_id ? await getAttemptStatusName(ctx, projectId, ws.attempt_status_id) : null;
      expect(wsStatus).toBe("reviewed");
    },
    TEST_TIMEOUT,
  );

  test(
    "moves ticket to blocked when session fails",
    async () => {
      const repo = createInitializedRepo(ctx, "combo-fail-block");

      writeHook(repo, "post-worktree-create", `mkdir -p "$PSTDIO_WORKTREE_PATH/files"`);

      writeHook(
        repo,
        "post-session-fail",
        `${cliPreamble()}
$PSTDIO tickets update --id "$PSTDIO_TICKET" --status blocked
$PSTDIO workspaces set-status --workspace "$PSTDIO_WORKSPACE" --status blocked
`,
      );

      const { attempt, projectId } = await createAttemptWithSession(ctx, repo, "combo-fail-block-repo");
      expect(attempt.session).toBeTruthy();
      await wait(2000);

      await updateSessionStatus(ctx, attempt.session!.id, "failed");
      await wait(3000);

      const tickets = (await (
        await fetch(`${api.url}/v1/tickets?project_id=${encodeURIComponent(projectId)}`)
      ).json()) as Array<{ id: string; status_id: string | null }>;
      const statusName = tickets[0].status_id ? await getStatusName(ctx, projectId, tickets[0].status_id) : null;
      expect(statusName).toBe("blocked");

      const ws = await getWorkspace(ctx, projectId, attempt.workspace.id);
      const wsStatus = ws.attempt_status_id ? await getAttemptStatusName(ctx, projectId, ws.attempt_status_id) : null;
      expect(wsStatus).toBe("blocked");
    },
    TEST_TIMEOUT,
  );
});

describe("ticket status change hook triggers further actions", () => {
  test(
    "post-ticket-status-change branches on target status name",
    async () => {
      const repo = createInitializedRepo(ctx, "combo-status-branch");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "combo-status-branch-repo");

      writeHook(
        repo,
        "post-ticket-status-change",
        `
STATUS_NAME="$PSTDIO_TO_STATUS"

if [ "$STATUS_NAME" = "wip" ]; then
  echo "moved-to-wip" > "${repo}/status-action.txt"
elif [ "$STATUS_NAME" = "done" ]; then
  echo "moved-to-done" > "${repo}/status-action.txt"
fi
`,
      );

      // Create a ticket
      const ticketRes = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_prompt: "branch test" }),
      });
      const ticket = (await ticketRes.json()) as { id: string };

      // Move to wip
      const wipId = await getStatusId(ctx, projectId, "wip");
      await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_id: wipId }),
      });
      await wait(1500);

      expect(existsSync(join(repo, "status-action.txt"))).toBe(true);
      expect(readFileSync(join(repo, "status-action.txt"), "utf8").trim()).toBe("moved-to-wip");

      // Move to done
      const doneId = await getStatusId(ctx, projectId, "done");
      await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_id: doneId }),
      });
      await wait(1500);

      expect(readFileSync(join(repo, "status-action.txt"), "utf8").trim()).toBe("moved-to-done");
    },
    TEST_TIMEOUT,
  );
});
