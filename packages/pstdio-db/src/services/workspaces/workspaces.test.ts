import { afterAll, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { workspaces } from "../../db/schemas.pg";
import { createAttemptStatusesDBService } from "../attempt-statuses/attempt-statuses";
import { createProjectsDBService } from "../projects/projects";
import { createTicketsDBService } from "../tickets/tickets";
import { createWorkspacesDBService } from "./workspaces";

let close: () => Promise<void>;
let db: DbClient;
let workspacesService: ReturnType<typeof createWorkspacesDBService>;
let projectId: string;
let ticketId: string;
let ticketShorthand: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;

  const projectsService = createProjectsDBService(result.db);
  const project = await projectsService.create({ name: "prompt-studio" });
  projectId = project.id;

  const ticketsService = createTicketsDBService(result.db);
  const ticket = await ticketsService.create({ project_id: projectId, display_title: "Test ticket" });
  ticketId = ticket.id;
  ticketShorthand = ticket.shorthand;

  workspacesService = createWorkspacesDBService(result.db);
};

afterAll(async () => {
  await close?.();
});

describe("createWorkspacesDBService", () => {
  test("creates a workspace with auto-generated shorthand", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
      branch: "workspace/PS-1_A1",
      worktree_path: "/repo/.pstdio/workspaces/PS-1_A1",
    });

    expect(ws.workspace_shorthand).toBe("PS-1_A1");
    expect(ws.name).toBe("PS-1_A1");
    expect(ws.attempt_status_id).toBeNull();
    expect(ws.archived).toBe(false);
  });

  test("increments shorthand for multiple workspaces on same ticket", async () => {
    await setup();

    const ws1 = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });
    const ws2 = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    expect(ws1.workspace_shorthand).toBe("PS-1_A1");
    expect(ws2.workspace_shorthand).toBe("PS-1_A2");
  });

  test("lists active workspaces with ticket shorthand", async () => {
    await setup();

    await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    const list = await workspacesService.list(projectId);

    expect(list.length).toBe(1);
    expect(list[0].workspace_shorthand).toBe("PS-1_A1");
    expect(list[0].ticket_shorthand).toBe("PS-1");
  });

  test("getByShorthand returns workspace or null", async () => {
    await setup();

    await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    const found = await workspacesService.getByShorthand(projectId, "PS-1_A1");
    expect(found).not.toBeNull();
    expect(found!.workspace_shorthand).toBe("PS-1_A1");

    const notFound = await workspacesService.getByShorthand(projectId, "PS-1_A99");
    expect(notFound).toBeNull();
  });

  test("softDelete hides workspace from list", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    await workspacesService.softDelete(ws.id);

    const list = await workspacesService.list(projectId);
    expect(list.length).toBe(0);

    const found = await workspacesService.getByShorthand(projectId, ws.workspace_shorthand);
    expect(found).toBeNull();
  });

  test("archive marks workspace as archived and hides it from list", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    const archived = await workspacesService.archive(ws.id);
    expect(archived).not.toBeNull();
    expect(archived!.archived).toBe(true);
    expect(archived!.deleted_at).toBeNull();

    const list = await workspacesService.list(projectId);
    expect(list.length).toBe(0);

    const found = await workspacesService.get(ws.id);
    expect(found).not.toBeNull();
    expect(found!.archived).toBe(true);
  });

  test("deleted workspaces count toward shorthand sequence", async () => {
    await setup();

    const ws1 = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });
    await workspacesService.softDelete(ws1.id);

    const ws2 = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    expect(ws2.workspace_shorthand).toBe("PS-1_A2");
  });

  test("orphaned workspaces count toward shorthand sequence", async () => {
    await setup();

    const timestamp = new Date().toISOString();
    await db.insert(workspaces).values({
      id: crypto.randomUUID(),
      project_id: projectId,
      name: "PS-1_A1",
      branch: null,
      worktree_path: null,
      attempt_status_id: null,
      archived: false,
      workspace_shorthand: "PS-1_A1",
      initializing: false,
      setup_error: null,
      startup_log_file_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    expect(ws.workspace_shorthand).toBe("PS-1_A2");
  });

  test("updateAttemptStatusId sets attempt status on workspace", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    const attemptStatusesService = createAttemptStatusesDBService(db);
    const status = await attemptStatusesService.getByName(projectId, "wip");

    const updated = await workspacesService.updateAttemptStatusId(ws.id, status!.id);
    expect(updated!.attempt_status_id).toBe(status!.id);

    const found = await workspacesService.get(ws.id);
    expect(found!.attempt_status_id).toBe(status!.id);
  });

  test("updateGitMetadata stores branch and worktree_path", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    await workspacesService.updateGitMetadata(ws.id, {
      branch: `workspace/${ws.workspace_shorthand}`,
      worktree_path: `/tmp/workspaces/${ws.workspace_shorthand}`,
    });

    const found = await workspacesService.get(ws.id);
    expect(found).not.toBeNull();
    expect(found!.branch).toBe(`workspace/${ws.workspace_shorthand}`);
    expect(found!.worktree_path).toBe(`/tmp/workspaces/${ws.workspace_shorthand}`);
  });
});
