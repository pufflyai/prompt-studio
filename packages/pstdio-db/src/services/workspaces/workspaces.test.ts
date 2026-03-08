import { afterAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsService } from "../projects/projects";
import { createTicketsService } from "../tickets/tickets";
import { createWorkspacesService } from "./workspaces";

let close: () => Promise<void>;
let db: DbClient;
let workspacesService: ReturnType<typeof createWorkspacesService>;
let projectId: string;
let ticketId: string;
let ticketShorthand: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;

  const projectsService = createProjectsService(result.db);
  const project = await projectsService.create({ name: "prompt-studio" });
  projectId = project.id;

  const ticketsService = createTicketsService(result.db);
  const ticket = await ticketsService.create({ project_id: projectId, display_title: "Test ticket" });
  ticketId = ticket.id;
  ticketShorthand = ticket.shorthand;

  workspacesService = createWorkspacesService(result.db);
};

afterAll(async () => {
  await close?.();
});

describe("createWorkspacesService", () => {
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
    expect(ws.status).toBe("active");
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

  test("updateStatus changes workspace status", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    await workspacesService.updateStatus(ws.id, "merged");

    const found = await workspacesService.getByShorthand(projectId, ws.workspace_shorthand);
    expect(found!.status).toBe("merged");
  });

  test("rejects invalid status values at DB layer", async () => {
    await setup();

    const ws = await workspacesService.create({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticketShorthand,
    });

    await expect(
      db.execute(sql`update workspaces set status = ${"paused"} where id = ${ws.id}`).execute(),
    ).rejects.toThrow();
  });
});
