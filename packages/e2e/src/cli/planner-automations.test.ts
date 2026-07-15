import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { e2eExtensions } from "../default-extensions";
import { cleanupDirs } from "./helpers";
import {
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
  api = await startApi({
    env: {
      PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(
        "pstdio-planner",
        "extension-lab",
        ".pstdio/extensions/pstdio-planner-loops",
      ),
    },
  });
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

const getExtensionInstanceId = async (projectId: string, installName: string) => {
  const res = await fetch(`${api.url}/v1/projects/${encodeURIComponent(projectId)}/extensions`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    extensions: Array<{ id: string; installName: string; enabled: boolean }>;
  };
  const match = body.extensions.find((extension) => extension.installName === installName && extension.enabled);
  expect(match).toBeDefined();
  return match!.id;
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
    "derives live workspace activity from ticket attempt sessions",
    async () => {
      const run = createRun(ctx);
      const repo = createInitializedRepo(ctx, "planner-automations");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "planner-automations-repo");

      const ticket = JSON.parse(run(`tickets create --content "# Workspace activity proof"`, repo)) as {
        id: string;
        shorthand: string;
      };

      const result = await executePlannerCommand(projectId, "pstdio-planner.run-attempt", {
        source: "api",
        params: {
          agent: { harnessId: "pstdio.extension-lab.fake" },
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
        workspace: { id: string; workspace_shorthand: string };
      };
      expect(value.workspace.workspace_shorthand).toBe(`${ticket.shorthand}_A1`);
      expect(value.session?.id).toBeString();

      const movedToInProgress = await waitFor(
        async () => (await getPlannerTicket(projectId, ticket.id)).statusId === "in-progress",
      );
      expect(movedToInProgress).toBe(true);

      const readActivity = async () => {
        const activity = await executePlannerCommand(projectId, "pstdio-planner.workspace-activity", {
          source: "api",
          params: { workspaceId: value.workspace.id },
        });
        expect(activity.outcome.ok).toBe(true);
        return activity.outcome.value as {
          active: boolean;
          sessions: Array<{ id: string; status: string }>;
        };
      };

      // The fake harness session finishes on its own; activity flips to inactive
      // with the completed session still listed.
      const settled = await waitFor(async () => {
        const activity = await readActivity();
        return !activity.active && activity.sessions.some((session) => session.status === "completed");
      });
      expect(settled).toBe(true);

      const workspaces = await executePlannerCommand(projectId, "pstdio-planner.ticket-workspaces", {
        source: "api",
        params: { id: ticket.shorthand },
      });
      expect(workspaces.outcome.ok).toBe(true);
      expect(workspaces.outcome.value).toEqual([
        expect.objectContaining({ id: value.workspace.id, workspace: `${ticket.shorthand}_A1`, active: false }),
      ]);
    },
    TEST_TIMEOUT,
  );

  test(
    "gates repo-local planner automation behind its project setting",
    async () => {
      const run = createRun(ctx);
      const repo = createInitializedRepo(ctx, "planner-loops");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "planner-loops-repo");

      // The stored workspace-status surface is gone: the old command id no longer
      // resolves on the planner's public surface.
      const removed = await fetch(
        `${api.url}/v1/projects/${encodeURIComponent(projectId)}/extensions/commands/pstdio-planner.workspaceStatus.set/execute`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: "api", params: { workspaceId: "w", status: "review-ready" } }),
        },
      );
      expect(removed.ok).toBe(false);

      const disabled = await executePlannerCommand(projectId, "pstdio-planner-loops.refine-tickets", {
        source: "api",
        params: {},
      });
      expect(disabled.outcome.ok).toBe(true);
      expect(disabled.outcome.value).toEqual({ ran: false, reason: "automation.enabled is off" });

      const automationInstanceId = await getExtensionInstanceId(projectId, "pstdio-planner-loops");
      const enable = await fetch(
        `${api.url}/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(automationInstanceId)}/settings/${encodeURIComponent("automation.enabled")}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: true }),
        },
      );
      expect(enable.status).toBe(200);

      // With no eligible Backlog work the enabled tick is a recorded no-op that
      // reads planner data across the extension boundary.
      const enabledTick = await executePlannerCommand(projectId, "pstdio-planner-loops.refine-tickets", {
        source: "api",
        params: {},
      });
      expect(enabledTick.outcome.ok).toBe(true);
      expect(enabledTick.outcome.value).toMatchObject({ ran: true, refined: null });

      run(`tickets create --content "# Loop candidate"`, repo);
      const candidateTick = await executePlannerCommand(projectId, "pstdio-planner-loops.implement-tickets", {
        source: "api",
        params: {},
      });
      expect(candidateTick.outcome.ok).toBe(true);
      // The candidate sits in Backlog, so implementation automation has nothing
      // Ready to pick up — but it ran, proving cross-extension planner reads.
      expect(candidateTick.outcome.value).toMatchObject({ ran: true, implemented: [] });
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
        workspace: { workspace_shorthand: string; anchors_json?: { type: string; label?: string }[] };
      };
      expect(workspaceValue.session).toBeNull();
      expect(workspaceValue.workspace.workspace_shorthand).toBe(`${ticket.shorthand}_A1`);
      expect(
        workspaceValue.workspace.anchors_json?.some(
          (anchor) => anchor.type === "ticket" && anchor.label === ticket.shorthand,
        ),
      ).toBe(true);

      const extensionInstanceId = await getExtensionInstanceId(projectId, "pstdio-planner");
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
