import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createSessionsDBService } from "../sessions/sessions";
import { createWorkspacesDBService } from "../workspaces/workspaces";
import { createWorkspaceSessionsDBService } from "./workspace-sessions";

let close: () => Promise<void>;
let db: DbClient;
let workspacesService: ReturnType<typeof createWorkspacesDBService>;
let sessionsService: ReturnType<typeof createSessionsDBService>;
let workspaceSessionsService: ReturnType<typeof createWorkspaceSessionsDBService>;
let projectId: string;

const ticketAnchor = { type: "ticket", id: "planner-ticket-1", label: "PS-1", metadata: { shorthand: "PS-1" } };

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;

  const projectsService = createProjectsDBService(db);
  const project = await projectsService.create({ name: "test-project" });
  projectId = project.id;

  workspacesService = createWorkspacesDBService(db);
  sessionsService = createSessionsDBService(db);
  workspaceSessionsService = createWorkspaceSessionsDBService(db);
};

beforeEach(setup);

afterEach(async () => {
  await close?.();
});

describe("createWorkspaceSessionsDBService", () => {
  test("link creates a workspace-session association", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    const session = await sessionsService.create({ project_id: projectId, title: "Session 1", agent: "claude-code" });

    const link = await workspaceSessionsService.link(ws.id, session.id);

    expect(link.workspace_id).toBe(ws.id);
    expect(link.session_id).toBe(session.id);
    expect(link.id).toBeDefined();
    expect(link.created_at).toBeDefined();
  });

  test("getWorkspaceBySessionId returns the linked workspace", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    const session = await sessionsService.create({ project_id: projectId, title: "Session 1", agent: "claude-code" });
    await workspaceSessionsService.link(ws.id, session.id);

    const found = await workspaceSessionsService.getWorkspaceBySessionId(session.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(ws.id);
  });

  test("getWorkspaceBySessionId returns null for unlinked session", async () => {
    const found = await workspaceSessionsService.getWorkspaceBySessionId("nonexistent");

    expect(found).toBeNull();
  });

  test("listByWorkspace returns all sessions for a workspace", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    const s1 = await sessionsService.create({ project_id: projectId, title: "Session 1", agent: "claude-code" });
    const s2 = await sessionsService.create({ project_id: projectId, title: "Session 2", agent: "claude-code" });
    await workspaceSessionsService.link(ws.id, s1.id);
    await workspaceSessionsService.link(ws.id, s2.id);

    const sessions = await workspaceSessionsService.listByWorkspace(ws.id);

    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
  });

  test("allows concurrent sessions on the same workspace", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    const s1 = await sessionsService.create({ project_id: projectId, title: "Implement", agent: "claude-code" });
    const s2 = await sessionsService.create({ project_id: projectId, title: "Review", agent: "claude-code" });

    await workspaceSessionsService.link(ws.id, s1.id);
    await workspaceSessionsService.link(ws.id, s2.id);

    const sessions = await workspaceSessionsService.listByWorkspace(ws.id);
    expect(sessions).toHaveLength(2);
  });

  test("rejects duplicate workspace-session link", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    const session = await sessionsService.create({ project_id: projectId, title: "Session 1", agent: "claude-code" });

    await workspaceSessionsService.link(ws.id, session.id);
    await expect(workspaceSessionsService.link(ws.id, session.id)).rejects.toThrow();
  });
});
