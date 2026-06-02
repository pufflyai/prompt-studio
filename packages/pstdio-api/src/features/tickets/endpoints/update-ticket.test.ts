import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TicketsTestContext } from "./tickets-test-harness";
import { createTicketsTestContext } from "./tickets-test-harness";

let context!: TicketsTestContext;

beforeAll(async () => {
  context = await createTicketsTestContext();

  const repoRoot = context.createGitRepo("update-ticket-repo");
  await context.app.request(`/v1/projects/${context.projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoRoot }),
  });
});

afterAll(() => {
  context.cleanup();
});

const createTicket = async (body: Record<string, unknown> = {}) => {
  const { app, projectId } = context;
  const res = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, ...body }),
  });

  expect(res.status).toBe(201);
  return res.json();
};

const createWorkspace = async (ticket: { id: string; shorthand: string }) => {
  const { app } = context;
  const res = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "current_branch", start_session: false }),
  });

  expect(res.status).toBe(201);
  const { workspace } = await res.json();
  return workspace;
};

const createWorkspaceSession = async (workspaceId: string) => {
  const { app, projectId } = context;
  const res = await app.request("/v1/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      title: "Workspace session",
      prompt: "Investigate ticket",
      agent: "fake",
      workspace_id: workspaceId,
    }),
  });

  expect(res.status).toBe(201);
  return res.json();
};

const writeBlockingArchiveExtension = () => {
  const root = join(context.tempRoot, "blocking-archive-extension");
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "blocking-archive-extension",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
      type: "module",
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `
      export default {
        hooks: {
          slowArchive: {
            eventId: "ticket.archived",
            async handler() {
              await new Promise((resolve) => setTimeout(resolve, 350));
            },
          },
        },
      };
    `,
  );
  return root;
};

describe("PATCH /v1/tickets/:id", () => {
  test("updates ticket display_title", async () => {
    const created = await createTicket({ content: "Original title" });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_title: "Updated title" }),
    });

    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.display_title).toBe("Updated title");

    const activityRes = await app.request(`/v1/tickets/${created.id}/activity`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as {
      events: Array<{
        event_type: string;
        payload_json: { display_title?: { from: string | null; to: string | null } };
      }>;
    };
    expect(activity.events[0].event_type).toBe("ticket_updated");
    expect(activity.events[0].payload_json.display_title).toEqual({ from: "Original title", to: "Updated title" });
  });

  test("returns 404 for non-existent ticket", async () => {
    const { app } = context;
    const res = await app.request("/v1/tickets/non-existent", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_title: "Nope" }),
    });
    expect(res.status).toBe(404);
  });

  test("updates canonical content file and derived display_title when content is provided", async () => {
    const created = await createTicket({ content: "# Original title\n\nOriginal body" });
    expect(created.file_id).not.toBeNull();

    const { app } = context;
    const updatedContent = "# Updated title\n\nUpdated body";
    const updateRes = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: updatedContent }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.display_title).toBe("Updated title");
    expect(updated.file_id).not.toBeNull();
    expect(updated.file_id).toBe(created.file_id);

    const fileRes = await app.request(`/v1/tickets/${created.id}/files/${updated.file_id}/content`);
    expect(fileRes.status).toBe(200);
    expect(await fileRes.text()).toBe(updatedContent);
  });

  test("updates blocked_reason when provided in the body", async () => {
    const created = await createTicket({ content: "# Blocked ticket" });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocked_reason: "waiting on upstream" }),
    });

    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.blocked_reason).toBe("waiting on upstream");
  });

  test("archives linked workspaces and workspace sessions when ticket is archived", async () => {
    const created = await createTicket({ content: "# Ticket title\n\nTicket body" });
    const workspace = await createWorkspace(created);
    const session = await createWorkspaceSession(workspace.id);

    const { app, projectId } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    expect(res.status).toBe(200);
    const updatedTicket = await res.json();
    expect(updatedTicket.archived).toBe(true);

    const workspaceRes = await app.request(
      `/v1/workspaces/by-shorthand?project_id=${projectId}&shorthand=${workspace.workspace_shorthand}`,
    );
    expect(workspaceRes.status).toBe(200);
    const updatedWorkspace = await workspaceRes.json();
    expect(updatedWorkspace.archived).toBe(true);

    const sessionRes = await app.request(`/v1/sessions/${session.id}`);
    expect(sessionRes.status).toBe(200);
    const updatedSession = await sessionRes.json();
    expect(updatedSession.archived).toBe(true);
  });

  test("does not wait for extension archive hooks before returning", async () => {
    const sourcePath = writeBlockingArchiveExtension();
    const originalListEnabledSources = context.deps.extensionService.listEnabledSourcesForProject;
    context.deps.extensionService.listEnabledSourcesForProject = async () =>
      [
        {
          instance: { id: "instance-1" },
          installedSource: {
            id: "source-1",
            extension_id: "pstdio.blocking-archive-extension",
            source_kind: "local",
            source_path: sourcePath,
          },
        },
      ] as never;

    try {
      const created = await createTicket({ content: "# Slow archive extension" });
      const { app } = context;
      const startedAt = Date.now();
      const res = await app.request(`/v1/tickets/${created.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      expect(res.status).toBe(200);
      expect(Date.now() - startedAt).toBeLessThan(200);
    } finally {
      context.deps.extensionService.listEnabledSourcesForProject = originalListEnabledSources;
    }
  });

  test("does not emit ticket_updated activity for empty patch", async () => {
    const created = await createTicket({ content: "No-op update ticket" });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);

    const activityRes = await app.request(`/v1/tickets/${created.id}/activity?event_type=ticket_updated`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as { events: Array<{ event_type: string }> };
    expect(activity.events).toHaveLength(0);
  });

  test("does not emit ticket_updated for no-op tag update", async () => {
    const { app, projectId } = context;
    const tagsRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    expect(tagsRes.status).toBe(200);
    const tags = (await tagsRes.json()) as Array<{ options: Array<{ id: string }> }>;
    const tagId = tags[0].options[0].id;

    const created = await createTicket({ content: "Tagged no-op ticket", tag_ids: [tagId] });

    const patchRes = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag_ids: [tagId] }),
    });
    expect(patchRes.status).toBe(200);

    const activityRes = await app.request(`/v1/tickets/${created.id}/activity?event_type=ticket_updated`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as { events: Array<{ event_type: string }> };
    expect(activity.events).toHaveLength(0);
  });
});
