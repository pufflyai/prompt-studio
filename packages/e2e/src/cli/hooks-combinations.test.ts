import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
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

// Helper: generates plugin code that updates a ticket status and workspace attempt status
const sessionActionPlugin = (hookName: string, ticketStatus: string, wsStatus: string) => `
import { mkdirSync } from "node:fs";

const API = "${api.url}";

const findTicketId = async (projectId, shorthand) => {
  const res = await fetch(API + "/v1/tickets?project_id=" + encodeURIComponent(projectId) + "&shorthand=" + encodeURIComponent(shorthand));
  const tickets = await res.json();
  return tickets[0]?.id;
};

const findStatusId = async (projectId, name) => {
  const res = await fetch(API + "/v1/projects/" + projectId + "/statuses");
  const statuses = await res.json();
  return statuses.find(s => s.name === name)?.id;
};

export default {
  hooks: {
    postWorktreeCreate(ctx) {
      mkdirSync(ctx.worktreePath + "/files", { recursive: true });
    },
    async ${hookName}(ctx) {
      const ticketId = await findTicketId(ctx.projectId, ctx.ticket.shorthand);
      const statusId = await findStatusId(ctx.projectId, "${ticketStatus}");
      await fetch(API + "/v1/tickets/" + ticketId, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_id: statusId }),
      });
      await fetch(API + "/v1/workspaces/" + ctx.workspaceId + "/attempt-status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "${wsStatus}" }),
      });
    },
  },
};
`;

describe("post-session-start moves ticket to wip", () => {
  test(
    "hook changes ticket status and workspace attempt status on session start",
    async () => {
      const repo = createInitializedRepo(ctx, "combo-session-wip");

      writePlugin(repo, "combo-session-wip-plugin.ts", sessionActionPlugin("postSessionStart", "wip", "wip"));

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

      writePlugin(repo, "combo-success-done-plugin.ts", sessionActionPlugin("postSessionSuccess", "done", "reviewed"));

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

      writePlugin(repo, "combo-fail-block-plugin.ts", sessionActionPlugin("postSessionFail", "blocked", "blocked"));

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
    "postTicketStatusChange branches on target status name",
    async () => {
      const repo = createInitializedRepo(ctx, "combo-status-branch");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "combo-status-branch-repo");

      writePlugin(
        repo,
        "combo-status-branch-plugin.ts",
        `
import { writeFileSync } from "node:fs";

export default {
  hooks: {
    postTicketStatusChange(ctx) {
      const statusName = ctx.toStatus;
      if (statusName === "wip") {
        writeFileSync("${repo}/status-action.txt", "moved-to-wip");
      } else if (statusName === "done") {
        writeFileSync("${repo}/status-action.txt", "moved-to-done");
      }
    },
  },
};
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
