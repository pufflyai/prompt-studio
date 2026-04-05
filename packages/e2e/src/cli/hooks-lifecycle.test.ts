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
  waitFor,
  waitForJsonFile,
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

describe("worktree creation hooks", () => {
  test(
    "pre-worktree-create blocks workspace creation on failure",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-wt-create-block");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-wt-create-block-repo");
      await configureAgent(ctx);

      writePlugin(
        repo,
        "pre-wt-guard.ts",
        `export default { hooks: { preWorktreeCreate: () => ({ reject: true, reason: "blocked" }) } };`,
      );

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
      writePlugin(
        repo,
        "pre-ticket-create-guard.ts",
        `export default { hooks: { preTicketCreation: () => ({ reject: true, reason: "Missing description" }) } };`,
      );
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
      const payloadFile = join(repo, "post-ticket-creation-payload.json");
      writePlugin(
        repo,
        "post-ticket-create-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postTicketCreation(ctx) { writeFileSync("${payloadFile}", JSON.stringify(ctx)); } } };
`,
      );
      await registerRepo(ctx, projectId, repo, "post-ticket-create-repo");

      const { res } = await createTicketViaApi(ctx, projectId);
      expect(res.status).toBe(201);

      const payload = await waitForJsonFile<{ shorthand: string }>(payloadFile);
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

      writePlugin(
        repo,
        "pre-ticket-delete-guard.ts",
        `export default { hooks: { preTicketDeletion: () => ({ reject: true, reason: "rejected" }) } };`,
      );
      const { ticket } = await createTicketViaApi(ctx, projectId);

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

      const markerFile = join(repo, "post-ticket-deletion-payload.json");
      writePlugin(
        repo,
        "post-ticket-delete-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postTicketDeletion(ctx) { writeFileSync("${markerFile}", JSON.stringify(ctx)); } } };
`,
      );

      const { ticket } = await createTicketViaApi(ctx, projectId);
      const deleteRes = await fetch(`${api.url}/v1/tickets/${ticket.id}`, { method: "DELETE" });
      expect(deleteRes.status).toBe(200);

      expect(await waitForPath(markerFile)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-ticket-archive rejects archive",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-ticket-archive");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-ticket-archive-repo");

      writePlugin(
        repo,
        "pre-ticket-archive-guard.ts",
        `export default { hooks: { preTicketArchive: () => ({ reject: true, reason: "rejected" }) } };`,
      );
      const { ticket } = await createTicketViaApi(ctx, projectId);

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

      const markerFile = join(repo, "post-ticket-archive-payload.json");
      writePlugin(
        repo,
        "post-ticket-archive-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postTicketArchive(ctx) { writeFileSync("${markerFile}", JSON.stringify(ctx)); } } };
`,
      );
      const { ticket } = await createTicketViaApi(ctx, projectId);

      await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      expect(await waitForPath(markerFile)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-ticket-status-change rejects status change",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-ticket-status");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-ticket-status-repo");

      writePlugin(
        repo,
        "pre-ticket-status-guard.ts",
        `export default { hooks: { preTicketStatusChange: () => ({ reject: true, reason: "rejected" }) } };`,
      );
      const { ticket } = await createTicketViaApi(ctx, projectId);
      const newStatusId = await getAlternateStatusId(ctx, projectId, ticket.status_id ?? null);

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

      const payloadFile = join(repo, "post-ticket-status-payload.json");
      writePlugin(
        repo,
        "post-ticket-status-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postTicketStatusChange(ctx) { writeFileSync("${payloadFile}", JSON.stringify(ctx)); } } };
`,
      );
      const { ticket } = await createTicketViaApi(ctx, projectId);
      const newStatusId = await getAlternateStatusId(ctx, projectId, ticket.status_id ?? null);

      await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_id: newStatusId }),
      });

      const payload = await waitForJsonFile<{
        shorthand: string;
        fromStatus: string;
        toStatus: string;
      }>(payloadFile);
      expect(payload.shorthand).toBeTruthy();
      expect(payload.fromStatus).toBeTruthy();
      expect(payload.toStatus).toBeTruthy();
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
      const payloadFile = join(repo, "session-start-payload.json");
      writePlugin(
        repo,
        "session-start-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postSessionStart(ctx) { writeFileSync("${payloadFile}", JSON.stringify(ctx)); } } };
`,
      );
      await registerRepo(ctx, projectId, repo, "session-start-repo");

      const { res } = await createSessionViaApi(ctx, projectId);
      expect(res.status).toBe(201);

      const payload = await waitForJsonFile<{ sessionId: string }>(payloadFile);
      expect(payload.sessionId).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-success fires when session completes",
    async () => {
      const repo = createInitializedRepo(ctx, "session-success");
      const projectId = getProjectId(repo);
      const payloadFile = join(repo, "session-success-payload.json");
      writePlugin(
        repo,
        "session-success-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postSessionSuccess(ctx) { writeFileSync("${payloadFile}", JSON.stringify(ctx)); } } };
`,
      );
      await registerRepo(ctx, projectId, repo, "session-success-repo");

      const { session } = await createSessionViaApi(ctx, projectId);
      await updateSessionStatus(ctx, session.id, "completed");

      const payload = await waitForJsonFile<{ sessionStatus: string }>(payloadFile);
      expect(payload.sessionStatus).toBe("completed");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-fail fires when session fails",
    async () => {
      const repo = createInitializedRepo(ctx, "session-fail");
      const projectId = getProjectId(repo);
      const payloadFile = join(repo, "session-fail-payload.json");
      writePlugin(
        repo,
        "session-fail-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postSessionFail(ctx) { writeFileSync("${payloadFile}", JSON.stringify(ctx)); } } };
`,
      );
      await registerRepo(ctx, projectId, repo, "session-fail-repo");

      const { session } = await createSessionViaApi(ctx, projectId);
      await updateSessionStatus(ctx, session.id, "failed");

      const payload = await waitForJsonFile<{ sessionStatus: string }>(payloadFile);
      expect(payload.sessionStatus).toBe("failed");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-await-input fires when session awaits input",
    async () => {
      const repo = createInitializedRepo(ctx, "session-await");
      const projectId = getProjectId(repo);
      const payloadFile = join(repo, "session-await-payload.json");
      writePlugin(
        repo,
        "session-await-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postSessionAwaitInput(ctx) { writeFileSync("${payloadFile}", JSON.stringify(ctx)); } } };
`,
      );
      await registerRepo(ctx, projectId, repo, "session-await-repo");

      const { session } = await createSessionViaApi(ctx, projectId);
      await updateSessionStatus(ctx, session.id, "awaiting_input");

      const payload = await waitForJsonFile<{ sessionStatus: string }>(payloadFile);
      expect(payload.sessionStatus).toBe("awaiting_input");
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
      const payloadFile = join(repo, "session-resume-payload.json");
      writePlugin(
        repo,
        "session-resume-logger.ts",
        `
import { writeFileSync } from "node:fs";
export default { hooks: { postSessionResume(ctx) { writeFileSync("${payloadFile}", JSON.stringify(ctx)); } } };
`,
      );
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

      const payload = await waitForJsonFile<{ sessionId: string }>(payloadFile);
      expect(payload.sessionId).toBe(session.id);
    },
    TEST_TIMEOUT,
  );
});

describe("attempt flow — session hooks receive worktree context", () => {
  test(
    "post-session-start receives worktreePath via attempt",
    async () => {
      const repo = createInitializedRepo(ctx, "attempt-start");

      writePlugin(
        repo,
        "attempt-start-wt.ts",
        `
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
export default {
  hooks: {
    postWorktreeCreate(ctx) {
      mkdirSync(ctx.worktreePath + "/files", { recursive: true });
      writeFileSync(ctx.worktreePath + "/files/hook-log.txt", "post-worktree-create\\n");
    },
    postSessionStart(ctx) {
      const root = ctx.worktreePath || ctx.repoPath || "";
      appendFileSync(root + "/files/hook-log.txt", "post-session-start worktree=" + (ctx.worktreePath || "") + "\\n");
    },
  },
};
`,
      );

      const { attempt, attemptRes } = await createAttemptWithSession(ctx, repo, "attempt-start-repo");
      expect(attemptRes.status).toBe(201);
      expect(attempt.workspace.worktree_path).toBeTruthy();
      expect(attempt.session).toBeTruthy();

      const logFile = join(attempt.workspace.worktree_path!, "files", "hook-log.txt");
      expect(
        await waitFor(() => existsSync(logFile) && readFileSync(logFile, "utf8").includes("post-session-start"), 5_000),
      ).toBe(true);

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

      writePlugin(
        repo,
        "hook-complete-flow-wt.ts",
        `
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
export default {
  hooks: {
    postWorktreeCreate(ctx) {
      mkdirSync(ctx.worktreePath + "/files", { recursive: true });
      writeFileSync(ctx.worktreePath + "/files/hook-log.txt", "post-worktree-create\\n");
    },
    postSessionSuccess(ctx) {
      const root = ctx.worktreePath || ctx.repoPath || "";
      appendFileSync(root + "/files/hook-log.txt", "post-session-success worktree=" + (ctx.worktreePath || "") + "\\n");
    },
  },
};
`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "hook-complete-flow-repo");
      expect(attempt.session).toBeTruthy();

      await updateSessionStatus(ctx, attempt.session!.id, "completed");
      const logFile = join(attempt.workspace.worktree_path!, "files", "hook-log.txt");
      expect(
        await waitFor(
          () => existsSync(logFile) && readFileSync(logFile, "utf8").includes("post-session-success"),
          5_000,
        ),
      ).toBe(true);

      const content = readFileSync(logFile, "utf8");
      expect(content).toContain("post-worktree-create");
      expect(content).toContain("post-session-success");
      expect(content).not.toContain("worktree=\n");
    },
    TEST_TIMEOUT,
  );
});
