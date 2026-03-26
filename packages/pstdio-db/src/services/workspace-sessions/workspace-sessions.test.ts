import { afterAll, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsService } from "../projects/projects";
import { createSessionsService } from "../sessions/sessions";
import { createTicketsService } from "../tickets/tickets";
import { createWorkspacesService } from "../workspaces/workspaces";
import { createWorkspaceSessionsService } from "./workspace-sessions";

let close: () => Promise<void>;
let db: DbClient;
let workspacesService: ReturnType<typeof createWorkspacesService>;
let sessionsService: ReturnType<typeof createSessionsService>;
let workspaceSessionsService: ReturnType<typeof createWorkspaceSessionsService>;
let projectId: string;
let ticketId: string;
let ticketShorthand: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;

  const projectsService = createProjectsService(db);
  const project = await projectsService.create({ name: "test-project" });
  projectId = project.id;

  const ticketsService = createTicketsService(db);
  const ticket = await ticketsService.create({ project_id: projectId, display_title: "Test ticket" });
  ticketId = ticket.id;
  ticketShorthand = ticket.shorthand;

  workspacesService = createWorkspacesService(db);
  sessionsService = createSessionsService(db);
  workspaceSessionsService = createWorkspaceSessionsService(db);
};

afterAll(async () => {
  await close?.();
});

describe("createWorkspaceSessionsService", () => {
  test("link creates a workspace-session association", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });
    const session = await sessionsService.create({ project_id: projectId, title: "Session 1", agent: "claude-code" });

    const link = await workspaceSessionsService.link(ws.id, session.id);

    expect(link.workspace_id).toBe(ws.id);
    expect(link.session_id).toBe(session.id);
    expect(link.id).toBeDefined();
    expect(link.created_at).toBeDefined();
  });

  test("getWorkspaceBySessionId returns the linked workspace", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });
    const session = await sessionsService.create({ project_id: projectId, title: "Session 1", agent: "claude-code" });
    await workspaceSessionsService.link(ws.id, session.id);

    const found = await workspaceSessionsService.getWorkspaceBySessionId(session.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(ws.id);
  });

  test("getWorkspaceBySessionId returns null for unlinked session", async () => {
    await setup();

    const found = await workspaceSessionsService.getWorkspaceBySessionId("nonexistent");

    expect(found).toBeNull();
  });

  test("listByWorkspace returns all sessions for a workspace", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
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
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });
    const s1 = await sessionsService.create({ project_id: projectId, title: "Implement", agent: "claude-code" });
    const s2 = await sessionsService.create({ project_id: projectId, title: "Review", agent: "claude-code" });

    await workspaceSessionsService.link(ws.id, s1.id);
    await workspaceSessionsService.link(ws.id, s2.id);

    const sessions = await workspaceSessionsService.listByWorkspace(ws.id);
    expect(sessions).toHaveLength(2);
  });

  test("rejects duplicate workspace-session link", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });
    const session = await sessionsService.create({ project_id: projectId, title: "Session 1", agent: "claude-code" });

    await workspaceSessionsService.link(ws.id, session.id);
    await expect(workspaceSessionsService.link(ws.id, session.id)).rejects.toThrow();
  });
});
