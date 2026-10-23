import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { cleanupDirs } from "./helpers";
import { createInitializedRepo, createRun, getProjectId, type HookTestContext, waitFor } from "./hooks-infra";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const ctx: HookTestContext = { api: null!, dirs: [] };

beforeAll(async () => {
  api = await startApi({
    env: {
      PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-planner", "workbench-fixture"),
    },
  });
  ctx.api = api;
}, SETUP_TIMEOUT);

afterAll(async () => {
  await api?.stop();
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
  input: { name: string; mimeType: string; data: Uint8Array<ArrayBuffer> },
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

describe("planner attempt workspaces", () => {
  test(
    "derives live workspace activity from ticket attempt sessions",
    async () => {
      const run = createRun(ctx);
      const repo = createInitializedRepo(ctx, "planner-attempt-workspaces");
      const projectId = getProjectId(repo);

      const template = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.templates.read", {
        source: "api",
        params: { name: "implement-ticket" },
      });
      expect(template.outcome.ok).toBe(true);
      const prompt = template.outcome.value as { name: string; title: string; type: string; content: string };
      const saved = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.templates.save", {
        source: "api",
        params: { ...prompt, content: `${prompt.content}\n__fake_hold__` },
      });
      expect(saved.outcome.ok).toBe(true);

      const ticket = JSON.parse(run(`tickets create --content "# Workspace activity proof"`, repo)) as {
        id: string;
        shorthand: string;
      };

      const result = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.run-attempt", {
        source: "api",
        params: {
          agent: { harnessId: "pstdio.workbench-fixture.harness.fake" },
          workspace: { providerId: "pstdio.worktree", params: { base: "HEAD" } },
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

      const readActivity = async () => {
        const activity = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.workspace-activity", {
          source: "api",
          params: { workspaceId: value.workspace.id },
        });
        expect(activity.outcome.ok).toBe(true);
        return activity.outcome.value as {
          active: boolean;
          sessions: Array<{ id: string; status: string }>;
        };
      };

      // The default fake run ends after 50 ms and can finish before the command returns.
      // Hold it until workspace activity has been observed.
      expect(await readActivity()).toMatchObject({ active: true });
      const sessionResponse = await fetch(`${api.url}/v1/sessions/${value.session!.id}`);
      expect(sessionResponse.status).toBe(200);
      const session = (await sessionResponse.json()) as { cwd: string };
      writeFileSync(join(session.cwd, ".fake-hold-release"), "");

      const settled = await waitFor(async () => {
        const activity = await readActivity();
        return !activity.active && activity.sessions.some((session) => session.status === "completed");
      });
      expect(settled).toBe(true);

      const workspaces = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.ticket-workspaces", {
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
    "creates ticket workspaces and previews image attachments through planner extension commands",
    async () => {
      const run = createRun(ctx);
      const repo = createInitializedRepo(ctx, "planner-ticket-actions");
      const projectId = getProjectId(repo);

      const ticket = JSON.parse(run(`tickets create --content "# Planner ticket actions"`, repo)) as {
        id: string;
        shorthand: string;
      };

      const workspaceResult = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.create-workspace", {
        source: "api",
        params: {
          rowId: ticket.id,
          provider_id: "pstdio.worktree",
          params: { base: "HEAD" },
        },
      });
      expect(workspaceResult.outcome.ok).toBe(true);
      const workspaceValue = workspaceResult.outcome.value as {
        workspace: { workspace_shorthand: string; anchors_json?: { type: string; label?: string }[] };
      };
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

      const attached = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.attach-file", {
        source: "api",
        params: { ticketId: ticket.id, ref: uploaded },
      });
      expect(attached.outcome.ok).toBe(true);

      const tree = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.ticket-files.tree.body", {
        source: "api",
        params: {
          renderer: {
            rendererId: "pstdio.pstdio-planner.view.ticket-files",
            resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
          },
        },
      });
      expect(tree.outcome.ok).toBe(true);
      const sections = tree.outcome.value as Array<{ id: string; nodes: Array<{ id: string; label: string }> }>;
      expect(sections.find((section) => section.id === "files")?.nodes).toContainEqual(
        expect.objectContaining({ id: uploaded.id, label: "diagram.png" }),
      );

      const preview = await executePlannerCommand(projectId, "pstdio.pstdio-planner.command.read-ticket-attachment", {
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
