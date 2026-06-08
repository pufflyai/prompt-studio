import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cleanupDirs } from "./helpers";
import {
  configureAgent,
  createInitializedRepo,
  createRun,
  getProjectId,
  type HookTestContext,
  registerRepo,
  waitFor,
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

const executePlannerCommand = async (projectId: string, commandId: string, body: Record<string, unknown>) => {
  const res = await fetch(
    `${api.url}/v1/projects/${encodeURIComponent(projectId)}/extensions/commands/${commandId}/execute`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  expect(res.status).toBe(200);
  return (await res.json()) as {
    outcome: { ok: boolean; error?: { message: string }; value?: unknown };
  };
};

const getPlannerTicket = async (projectId: string, id: string) => {
  const result = await executePlannerCommand(projectId, "pstdio-planner.get-ticket", {
    source: "api",
    params: { id },
  });
  expect(result.outcome.ok).toBe(true);
  return result.outcome.value as { id: string; shorthand: string; statusId: string | null };
};

const listSessions = async (projectId: string) => {
  const res = await fetch(`${api.url}/v1/sessions?project_id=${encodeURIComponent(projectId)}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Array<{
    id: string;
    title: string;
    original_session_id: string | null;
  }>;
};

const getSessionMessageCount = async (sessionId: string) => {
  const res = await fetch(`${api.url}/v1/sessions/${encodeURIComponent(sessionId)}/conversation`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { messages: unknown[] };
  return body.messages.length;
};

describe("planner automations", () => {
  test(
    "runs the planner ticket workspace automation flow end to end",
    async () => {
      const run = createRun(ctx);
      const repo = createInitializedRepo(ctx, "planner-automations");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "planner-automations-repo");
      await configureAgent(ctx);

      const ticket = JSON.parse(run(`tickets create --content "# Planner automation proof"`, repo)) as {
        id: string;
        shorthand: string;
      };

      const result = await executePlannerCommand(projectId, "pstdio-planner.run-attempt", {
        source: "api",
        params: {
          agent: { harnessId: "fake" },
          mode: "current_branch",
        },
        resource: {
          type: "ticket",
          id: ticket.id,
          projectId,
          label: ticket.shorthand,
          extensionId: "pstdio.pstdio-planner",
        },
      });

      expect(result.outcome.ok).toBe(true);

      const value = result.outcome.value as {
        session: { id: string } | null;
        workspace: { workspace_shorthand: string; ticket_shorthand?: string | null };
      };
      expect(value.workspace.workspace_shorthand).toBe(`${ticket.shorthand}_A1`);
      expect(value.workspace.ticket_shorthand).toBe(ticket.shorthand);
      expect(value.session?.id).toBeString();

      const originalSessionId = value.session!.id;
      const workspaceId = value.workspace.workspace_shorthand;
      const movedToInProgress = await waitFor(
        async () => (await getPlannerTicket(projectId, ticket.id)).statusId === "default-in-progress",
      );
      expect(movedToInProgress).toBe(true);

      const beforeFollowUpCount = await getSessionMessageCount(originalSessionId);
      const reviewReady = await executePlannerCommand(projectId, "pstdio-planner.workspaceStatus.set", {
        source: "api",
        params: {
          workspace: workspaceId,
          status: "review-ready",
          sessionId: originalSessionId,
        },
      });
      expect(reviewReady.outcome.ok).toBe(true);

      const sessionsAfterReviewReady = await listSessions(projectId);
      const reviewSession = sessionsAfterReviewReady.find(
        (session) => session.title === `Code review: ${ticket.shorthand}`,
      );
      expect(reviewSession).toBeDefined();
      expect(reviewSession?.original_session_id).toBe(originalSessionId);

      const changesRequested = await executePlannerCommand(projectId, "pstdio-planner.workspaceStatus.set", {
        source: "api",
        params: {
          workspace: workspaceId,
          status: "changes-requested",
          sessionId: reviewSession!.id,
        },
      });
      expect(changesRequested.outcome.ok).toBe(true);

      const followedUp = await waitFor(
        async () => (await getSessionMessageCount(originalSessionId)) > beforeFollowUpCount,
      );
      expect(followedUp).toBe(true);

      const reviewed = await executePlannerCommand(projectId, "pstdio-planner.workspaceStatus.set", {
        source: "api",
        params: {
          workspace: workspaceId,
          status: "reviewed",
          sessionId: originalSessionId,
        },
      });
      expect(reviewed.outcome.ok).toBe(true);

      const movedToReview = await waitFor(
        async () => (await getPlannerTicket(projectId, ticket.id)).statusId === "default-in-review",
      );
      expect(movedToReview).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
