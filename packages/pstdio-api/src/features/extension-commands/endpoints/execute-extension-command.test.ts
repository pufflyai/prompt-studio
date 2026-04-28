import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createFakeAgent } from "pstdio-agents";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let tempDirs: string[] = [];
let closeFns: Array<() => Promise<void>> = [];

const writeStorageExtension = (repoPath: string) => {
  const dir = join(repoPath, ".pstdio", "extensions", "extension-lab");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
      id: "project.extension-lab",
      name: "Extension Lab",
      commands: {
        inspectProject: {
          title: "Inspect project",
          target: "project",
          params: {
            note: { type: "text" },
          },
          async run(ctx) {
            const previous = await ctx.storage.get("lastInspect");
            await ctx.storage.set("lastInspect", { note: ctx.params.note });

            return {
              note: ctx.params.note,
              previous,
              target: ctx.target,
            };
          },
        },
      },
    };`,
  );
};

const writeTicketStorageExtension = (repoPath: string) => {
  const dir = join(repoPath, ".pstdio", "extensions", "ticket-storage");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
      id: "project.ticket-storage",
      name: "Ticket Storage",
      commands: {
        createTicket: {
          title: "Create ticket",
          target: "project",
          async run(ctx) {
            const ticket = {
              id: "PS-1",
              shorthand: "PS-1",
              title: ctx.params.title,
            };

            await ctx.storage.collection("tickets").put(ticket.id, ticket);
            await ctx.activity.record({
              eventType: "ticket.created",
              summary: "Ticket created",
              target: {
                type: "project.ticket-storage.ticket",
                id: ticket.id,
                projectId: ctx.projectId,
                extensionId: "project.ticket-storage",
              },
            });

            return ticket;
          },
        },
      },
    };`,
  );
};

const writeSessionExtension = (repoPath: string) => {
  const dir = join(repoPath, ".pstdio", "extensions", "extension-lab");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
      id: "project.extension-lab",
      name: "Extension Lab",
      commands: {
        startReview: {
          title: "Start review",
          target: "project",
          async run(ctx) {
            const session = await ctx.sessions.create({
              title: "Review from extension",
              prompt: "Review this project.",
            });

            return {
              sessionId: session.id,
              sessionTitle: session.title,
            };
          },
        },
      },
    };`,
  );
};

const createProjectWithExtension = async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-extension-command-test-"));
  tempDirs.push(tempRoot);

  const repoPath = join(tempRoot, "repo");
  mkdirSync(repoPath, { recursive: true });
  writeStorageExtension(repoPath);

  const { app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  closeFns.push(close);

  const projectResponse = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Extension Command Project" }),
  });
  const project = await projectResponse.json();

  await app.request(`/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoPath }),
  });

  return { app, projectId: project.id } as { app: OpenAPIHono<AppBindings>; projectId: string };
};

const createProjectWithTicketStorageExtension = async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-extension-command-ticket-storage-test-"));
  tempDirs.push(tempRoot);

  const repoPath = join(tempRoot, "repo");
  mkdirSync(repoPath, { recursive: true });
  writeTicketStorageExtension(repoPath);

  const { app, close, deps } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  closeFns.push(close);

  const projectResponse = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Extension Ticket Storage Project" }),
  });
  const project = await projectResponse.json();

  await app.request(`/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoPath }),
  });

  return { app, deps, projectId: project.id } as {
    app: OpenAPIHono<AppBindings>;
    deps: Awaited<ReturnType<typeof createApp>>["deps"];
    projectId: string;
  };
};

const createProjectWithSessionExtension = async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-extension-command-session-test-"));
  tempDirs.push(tempRoot);

  const repoPath = join(tempRoot, "repo");
  mkdirSync(repoPath, { recursive: true });
  writeSessionExtension(repoPath);

  const { app, close, deps } = await createApp({
    agents: [createFakeAgent()],
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  closeFns.push(close);

  await deps.agentConfigService.upsert("fake");

  const projectResponse = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Extension Command Session Project", agents: ["fake"] }),
  });
  const project = await projectResponse.json();

  await app.request(`/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoPath }),
  });

  return { app, projectId: project.id } as { app: OpenAPIHono<AppBindings>; projectId: string };
};

const executeInspectProject = (app: OpenAPIHono<AppBindings>, projectId: string, note: string) =>
  app.request(`/v1/projects/${projectId}/extension-commands/project.extension-lab.inspectProject/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ params: { note } }),
  });

const waitForSessionStatus = async (app: OpenAPIHono<AppBindings>, sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await app.request(`/v1/sessions/${sessionId}`);
    expect(response.status).toBe(200);
    const session = await response.json();
    if (session.status === expectedStatus) return session;
    await Bun.sleep(20);
  }

  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

afterEach(async () => {
  for (const close of closeFns) {
    await close();
  }
  closeFns = [];

  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("POST /v1/projects/:projectId/extension-commands/:commandId/execute", () => {
  test("executes extension commands inside the API service", async () => {
    const { app, projectId } = await createProjectWithExtension();

    const firstResponse = await executeInspectProject(app, projectId, "first");
    expect(firstResponse.status).toBe(200);
    expect(await firstResponse.json()).toEqual({
      result: {
        note: "first",
        previous: null,
        target: { type: "project", id: projectId, projectId },
      },
    });

    const secondResponse = await executeInspectProject(app, projectId, "second");
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toEqual({
      result: {
        note: "second",
        previous: { note: "first" },
        target: { type: "project", id: projectId, projectId },
      },
    });
  });

  test("creates API sessions when extension commands request prompts", async () => {
    const { app, projectId } = await createProjectWithSessionExtension();

    const response = await app.request(
      `/v1/projects/${projectId}/extension-commands/project.extension-lab.startReview/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.sessionTitle).toBe("Review from extension");
    expect(body.result.sessionId).toBeString();

    const sessionsResponse = await app.request(`/v1/sessions?project_id=${projectId}`);
    expect(sessionsResponse.status).toBe(200);
    const sessions = await sessionsResponse.json();
    expect(sessions).toContainEqual(
      expect.objectContaining({
        id: body.result.sessionId,
        title: "Review from extension",
        agent: "fake",
      }),
    );

    await waitForSessionStatus(app, body.result.sessionId, "completed");
  });

  test("persists extension-owned ticket mutations to generic sync and activity state", async () => {
    const { app, deps, projectId } = await createProjectWithTicketStorageExtension();
    const events: { table: string; op: string; data: unknown }[] = [];
    deps.eventBus.subscribe((event) => events.push(event));

    const response = await app.request(
      `/v1/projects/${projectId}/extension-commands/project.ticket-storage.createTicket/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params: { title: "Planner-owned ticket" } }),
      },
    );

    expect(response.status).toBe(200);

    const state = await deps.syncService.getFullState();
    expect(state.extension_collection_items).toContainEqual(
      expect.objectContaining({
        extension_id: "project.ticket-storage",
        collection: "tickets",
        item_id: "PS-1",
        value_json: {
          id: "PS-1",
          shorthand: "PS-1",
          title: "Planner-owned ticket",
        },
      }),
    );
    expect(state.activity_events).toContainEqual(
      expect.objectContaining({
        source_extension_id: "project.ticket-storage",
        resource_type: "project.ticket-storage.ticket",
        resource_id: "PS-1",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        table: "extension_collection_items",
        op: "set",
        data: expect.objectContaining({ item_id: "PS-1" }),
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        table: "activity_events",
        op: "set",
        data: expect.objectContaining({ resource_id: "PS-1" }),
      }),
    );
  });
});
