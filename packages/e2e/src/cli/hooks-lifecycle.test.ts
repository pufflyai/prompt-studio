import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
import {
  configureAgent,
  createAttemptWithSession,
  createInitializedRepo,
  createRun,
  createSessionViaApi,
  createTicketViaApi,
  getAlternateStatusId,
  getProjectId,
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

describe("worktree creation hooks", () => {
  test(
    "pre-worktree-create blocks workspace creation on failure",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-wt-create-block");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-wt-create-block-repo");
      await configureAgent(ctx);

      writeHook(repo, "pre-worktree-create", 'echo "blocked" >&2; exit 1');

      const run = createRun(ctx);
      const createTicketOutput = run('tickets create --content "hook block test"', repo);
      const ticketShorthand = createTicketOutput.match(/Created ticket (\S+)/)![1];

      const ticketRes = await fetch(`${api.url}/v1/tickets?project_id=${encodeURIComponent(projectId)}`);
      const tickets = (await ticketRes.json()) as Array<{ id: string; shorthand: string }>;
      const ticket = tickets.find((t) => t.shorthand === ticketShorthand)!;

      const attemptRes = await fetch(`${api.url}/v1/tickets/${ticket.id}/attempts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start_session: false }),
      });
      expect(attemptRes.status).toBe(500);
    },
    TEST_TIMEOUT,
  );
});

describe("ticket hooks", () => {
  test(
    "pre-ticket-creation rejects ticket creation",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-ticket-reject");
      const projectId = getProjectId(repo);
      writeHook(repo, "pre-ticket-creation", 'echo "Missing description" >&2; exit 1');
      await registerRepo(ctx, projectId, repo, "pre-ticket-reject-repo");

      const { res } = await createTicketViaApi(ctx, projectId);
      expect(res.status).toBe(403);
    },
    TEST_TIMEOUT,
  );

  test(
    "post-ticket-creation fires with payload",
    async () => {
      const repo = createInitializedRepo(ctx, "post-ticket-create");
      const projectId = getProjectId(repo);
      writeHook(repo, "post-ticket-creation", `cat > "${repo}/post-ticket-creation-payload.json"`);
      await registerRepo(ctx, projectId, repo, "post-ticket-create-repo");

      const { res } = await createTicketViaApi(ctx, projectId);
      expect(res.status).toBe(201);

      await wait(500);
      expect(existsSync(join(repo, "post-ticket-creation-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "post-ticket-creation-payload.json"), "utf8"));
      expect(payload.shorthand).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-ticket-deletion rejects deletion",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-ticket-delete");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-ticket-delete-repo");

      const { ticket } = await createTicketViaApi(ctx, projectId);
      writeHook(repo, "pre-ticket-deletion", "exit 1");

      const deleteRes = await fetch(`${api.url}/v1/tickets/${ticket.id}`, { method: "DELETE" });
      expect(deleteRes.status).toBe(403);
    },
    TEST_TIMEOUT,
  );

  test(
    "post-ticket-deletion fires after successful delete",
    async () => {
      const repo = createInitializedRepo(ctx, "post-ticket-delete");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "post-ticket-delete-repo");

      const { ticket } = await createTicketViaApi(ctx, projectId);
      writeHook(repo, "post-ticket-deletion", `cat > "${repo}/post-ticket-deletion-payload.json"`);

      const deleteRes = await fetch(`${api.url}/v1/tickets/${ticket.id}`, { method: "DELETE" });
      expect(deleteRes.status).toBe(200);

      await wait(500);
      expect(existsSync(join(repo, "post-ticket-deletion-payload.json"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-ticket-archive rejects archive",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-ticket-archive");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-ticket-archive-repo");

      const { ticket } = await createTicketViaApi(ctx, projectId);
      writeHook(repo, "pre-ticket-archive", "exit 1");

      const archiveRes = await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      expect(archiveRes.status).toBe(403);
    },
    TEST_TIMEOUT,
  );

  test(
    "post-ticket-archive fires after archive",
    async () => {
      const repo = createInitializedRepo(ctx, "post-ticket-archive");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "post-ticket-archive-repo");

      const { ticket } = await createTicketViaApi(ctx, projectId);
      writeHook(repo, "post-ticket-archive", `cat > "${repo}/post-ticket-archive-payload.json"`);

      await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      await wait(500);
      expect(existsSync(join(repo, "post-ticket-archive-payload.json"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-ticket-status-change rejects status change",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-ticket-status");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-ticket-status-repo");

      const { ticket } = await createTicketViaApi(ctx, projectId);
      const newStatusId = await getAlternateStatusId(ctx, projectId, ticket.status_id ?? null);
      writeHook(repo, "pre-ticket-status-change", "exit 1");

      const res = await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_id: newStatusId }),
      });
      expect(res.status).toBe(403);
    },
    TEST_TIMEOUT,
  );

  test(
    "post-ticket-status-change fires after status change",
    async () => {
      const repo = createInitializedRepo(ctx, "post-ticket-status");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "post-ticket-status-repo");

      const { ticket } = await createTicketViaApi(ctx, projectId);
      const newStatusId = await getAlternateStatusId(ctx, projectId, ticket.status_id ?? null);
      writeHook(repo, "post-ticket-status-change", `cat > "${repo}/post-ticket-status-payload.json"`);

      await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_id: newStatusId }),
      });

      await wait(500);
      expect(existsSync(join(repo, "post-ticket-status-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "post-ticket-status-payload.json"), "utf8"));
      expect(payload.status_id).toBe(newStatusId);
    },
    TEST_TIMEOUT,
  );
});

describe("session hooks", () => {
  test(
    "post-session-start fires when session is created",
    async () => {
      const repo = createInitializedRepo(ctx, "session-start");
      const projectId = getProjectId(repo);
      writeHook(repo, "post-session-start", `cat > "${repo}/session-start-payload.json"`);
      await registerRepo(ctx, projectId, repo, "session-start-repo");

      const { res } = await createSessionViaApi(ctx, projectId);
      expect(res.status).toBe(201);

      await wait(500);
      expect(existsSync(join(repo, "session-start-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "session-start-payload.json"), "utf8"));
      expect(payload.session.id).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-success fires when session completes",
    async () => {
      const repo = createInitializedRepo(ctx, "session-success");
      const projectId = getProjectId(repo);
      writeHook(repo, "post-session-success", `cat > "${repo}/session-success-payload.json"`);
      await registerRepo(ctx, projectId, repo, "session-success-repo");

      const { session } = await createSessionViaApi(ctx, projectId);
      await updateSessionStatus(ctx, session.id, "completed");

      await wait(500);
      expect(existsSync(join(repo, "session-success-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "session-success-payload.json"), "utf8"));
      expect(payload.session.status).toBe("completed");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-fail fires when session fails",
    async () => {
      const repo = createInitializedRepo(ctx, "session-fail");
      const projectId = getProjectId(repo);
      writeHook(repo, "post-session-fail", `cat > "${repo}/session-fail-payload.json"`);
      await registerRepo(ctx, projectId, repo, "session-fail-repo");

      const { session } = await createSessionViaApi(ctx, projectId);
      await updateSessionStatus(ctx, session.id, "failed");

      await wait(500);
      expect(existsSync(join(repo, "session-fail-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "session-fail-payload.json"), "utf8"));
      expect(payload.session.status).toBe("failed");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-await-input fires when session awaits input",
    async () => {
      const repo = createInitializedRepo(ctx, "session-await");
      const projectId = getProjectId(repo);
      writeHook(repo, "post-session-await-input", `cat > "${repo}/session-await-payload.json"`);
      await registerRepo(ctx, projectId, repo, "session-await-repo");

      const { session } = await createSessionViaApi(ctx, projectId);
      await updateSessionStatus(ctx, session.id, "awaiting_input");

      await wait(500);
      expect(existsSync(join(repo, "session-await-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "session-await-payload.json"), "utf8"));
      expect(payload.session.status).toBe("awaiting_input");
    },
    TEST_TIMEOUT,
  );
});

describe("session resume hook", () => {
  test(
    "post-session-resume fires when session receives a follow-up",
    async () => {
      const repo = createInitializedRepo(ctx, "session-resume");
      const projectId = getProjectId(repo);
      writeHook(repo, "post-session-resume", `cat > "${repo}/session-resume-payload.json"`);
      await registerRepo(ctx, projectId, repo, "session-resume-repo");

      const { session } = await createSessionViaApi(ctx, projectId);
      // session starts as in_progress — move to completed so follow-up is accepted
      await updateSessionStatus(ctx, session.id, "completed");

      const followUpRes = await fetch(`${api.url}/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "continue" }),
      });
      expect(followUpRes.status).toBe(200);

      await wait(500);
      expect(existsSync(join(repo, "session-resume-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "session-resume-payload.json"), "utf8"));
      expect(payload.session.id).toBe(session.id);
    },
    TEST_TIMEOUT,
  );
});

describe("attempt flow — session hooks receive worktree context", () => {
  test(
    "post-session-start receives PSTDIO_WORKTREE_PATH via attempt",
    async () => {
      const repo = createInitializedRepo(ctx, "attempt-start");

      writeHook(
        repo,
        "post-worktree-create",
        `
mkdir -p "$PSTDIO_WORKTREE_PATH/files"
echo "post-worktree-create" > "$PSTDIO_WORKTREE_PATH/files/hook-log.txt"
`,
      );
      writeHook(
        repo,
        "post-session-start",
        `
NOTE_ROOT=\${PSTDIO_WORKTREE_PATH:-$PSTDIO_REPO_PATH}
echo "post-session-start worktree=$PSTDIO_WORKTREE_PATH" >> "$NOTE_ROOT/files/hook-log.txt"
`,
      );

      const { attempt, attemptRes } = await createAttemptWithSession(ctx, repo, "attempt-start-repo");
      expect(attemptRes.status).toBe(201);
      expect(attempt.workspace.worktree_path).toBeTruthy();
      expect(attempt.session).toBeTruthy();
      await wait(2000);

      const logFile = join(attempt.workspace.worktree_path!, "files", "hook-log.txt");
      expect(existsSync(logFile)).toBe(true);

      const content = readFileSync(logFile, "utf8");
      expect(content).toContain("post-worktree-create");
      expect(content).toContain("post-session-start");
      expect(content).not.toContain("worktree=\n");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-success receives worktree context after completion",
    async () => {
      const repo = createInitializedRepo(ctx, "hook-complete-flow");

      writeHook(
        repo,
        "post-worktree-create",
        `
mkdir -p "$PSTDIO_WORKTREE_PATH/files"
echo "post-worktree-create" > "$PSTDIO_WORKTREE_PATH/files/hook-log.txt"
`,
      );
      writeHook(
        repo,
        "post-session-success",
        `
NOTE_ROOT=\${PSTDIO_WORKTREE_PATH:-$PSTDIO_REPO_PATH}
echo "post-session-success worktree=$PSTDIO_WORKTREE_PATH" >> "$NOTE_ROOT/files/hook-log.txt"
`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "hook-complete-flow-repo");
      expect(attempt.session).toBeTruthy();
      await wait(2000);

      await updateSessionStatus(ctx, attempt.session!.id, "completed");
      await wait(1000);
      const logFile = join(attempt.workspace.worktree_path!, "files", "hook-log.txt");
      expect(existsSync(logFile)).toBe(true);

      const content = readFileSync(logFile, "utf8");
      expect(content).toContain("post-worktree-create");
      expect(content).toContain("post-session-success");
      expect(content).not.toContain("worktree=\n");
    },
    TEST_TIMEOUT,
  );
});
