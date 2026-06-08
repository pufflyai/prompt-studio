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

const getPlannerExtensionInstanceId = async (projectId: string) => {
  const res = await fetch(`${api.url}/v1/projects/${encodeURIComponent(projectId)}/extensions`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    extensions: Array<{ id: string; installName: string; enabled: boolean }>;
  };
  const planner = body.extensions.find((extension) => extension.installName === "pstdio-planner" && extension.enabled);
  expect(planner).toBeDefined();
  return planner!.id;
};

const uploadPlannerFile = async (
  projectId: string,
  extensionInstanceId: string,
  input: { name: string; mimeType: string; data: Uint8Array },
) => {
  const res = await fetch(
    `${api.url}/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(extensionInstanceId)}/files?scope_type=resource&scope_id=ticket-attachment`,
    {
      method: "POST",
      headers: {
        "content-type": input.mimeType,
        "x-file-name": encodeURIComponent(input.name),
      },
      body: input.data,
    },
  );
  expect(res.status).toBe(201);
  return (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    hash: string | null;
    url: string;
    createdAt: string;
    updatedAt: string;
  };
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

  test(
    "creates ticket workspaces and previews image attachments through planner extension commands",
    async () => {
      const run = createRun(ctx);
      const repo = createInitializedRepo(ctx, "planner-ticket-actions");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "planner-ticket-actions-repo");

      const ticket = JSON.parse(run(`tickets create --content "# Planner ticket actions"`, repo)) as {
        id: string;
        shorthand: string;
      };

      const workspaceResult = await executePlannerCommand(projectId, "pstdio-planner.create-workspace", {
        source: "api",
        params: {
          rowId: ticket.id,
          mode: "current_branch",
        },
      });
      expect(workspaceResult.outcome.ok).toBe(true);
      const workspaceValue = workspaceResult.outcome.value as {
        session: unknown;
        workspace: { workspace_shorthand: string; ticket_shorthand?: string | null };
      };
      expect(workspaceValue.session).toBeNull();
      expect(workspaceValue.workspace.workspace_shorthand).toBe(`${ticket.shorthand}_A1`);
      expect(workspaceValue.workspace.ticket_shorthand).toBe(ticket.shorthand);

      const extensionInstanceId = await getPlannerExtensionInstanceId(projectId);
      const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      const uploaded = await uploadPlannerFile(projectId, extensionInstanceId, {
        name: "diagram.png",
        mimeType: "image/png",
        data: imageBytes,
      });

      const attached = await executePlannerCommand(projectId, "pstdio-planner.attach-file", {
        source: "api",
        params: { ticketId: ticket.id, ref: uploaded },
      });
      expect(attached.outcome.ok).toBe(true);

      const tree = await executePlannerCommand(projectId, "pstdio-planner.ticket-files.tree.body", {
        source: "api",
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
      });
      expect(tree.outcome.ok).toBe(true);
      const sections = tree.outcome.value as Array<{ id: string; nodes: Array<{ id: string; label: string }> }>;
      expect(sections.find((section) => section.id === "files")?.nodes).toContainEqual(
        expect.objectContaining({ id: uploaded.id, label: "diagram.png" }),
      );

      const preview = await executePlannerCommand(projectId, "pstdio-planner.read-ticket-attachment", {
        source: "api",
        params: { ticketId: ticket.id, attachmentId: uploaded.id },
      });
      expect(preview.outcome.ok).toBe(true);
      expect(preview.outcome.value).toEqual({
        dataUrl: `data:image/png;base64,${Buffer.from(imageBytes).toString("base64")}`,
      });
    },
    TEST_TIMEOUT,
  );
});
