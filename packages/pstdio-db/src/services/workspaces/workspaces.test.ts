import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { workspaces } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createWorkspacesDBService } from "./workspaces";

let close: () => Promise<void>;
let db: DbClient;
let workspacesService: ReturnType<typeof createWorkspacesDBService>;
let projectId: string;

const ticketAnchor = { type: "ticket", id: "planner-ticket-1", label: "PS-1", metadata: { shorthand: "PS-1" } };

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;

  const projectsService = createProjectsDBService(result.db);
  const project = await projectsService.create({ name: "prompt-studio" });
  projectId = project.id;

  workspacesService = createWorkspacesDBService(result.db);
};

beforeEach(setup);

afterEach(async () => {
  await close?.();
});

describe("createWorkspacesDBService", () => {
  test("creates a workspace with auto-generated shorthand", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
      branch: "workspace/PS-1_A1",
      worktree_path: "/repo/.pstdio/workspaces/PS-1_A1",
    });

    expect(ws.workspace_shorthand).toBe("PS-1_A1");
    expect(ws.name).toBe("PS-1_A1");
    expect(ws.archived).toBe(false);
  });

  test("increments shorthand for multiple workspaces on same ticket", async () => {
    const ws1 = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    const ws2 = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });

    expect(ws1.workspace_shorthand).toBe("PS-1_A1");
    expect(ws2.workspace_shorthand).toBe("PS-1_A2");
  });

  test("lists active workspaces with their resource anchors", async () => {
    await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });

    const list = await workspacesService.list(projectId);

    expect(list.length).toBe(1);
    expect(list[0].workspace_shorthand).toBe("PS-1_A1");
    expect(list[0].anchors_json).toEqual([ticketAnchor]);
  });

  test("lists standalone and default workspaces without resource anchors", async () => {
    const standalone = await workspacesService.createStandalone({ project_id: projectId });
    const defaultWorkspace = await workspacesService.createDefault({
      project_id: projectId,
      name: "prompt-studio",
      branch: "main",
    });

    const list = await workspacesService.list(projectId);

    expect(list.map((workspace) => workspace.workspace_shorthand).sort()).toEqual(["WS-1", "default"]);
    expect(list.find((workspace) => workspace.id === standalone.id)?.anchors_json).toEqual([]);
    expect(list.find((workspace) => workspace.id === defaultWorkspace.id)?.anchors_json).toEqual([]);
  });

  test("createStandalone creates a ticketless workspace with a WS- shorthand", async () => {
    const ws = await workspacesService.createStandalone({
      project_id: projectId,
      name: "T-1 attempt",
      branch: "workspace/WS-1",
      worktree_path: "/repo/.pstdio/workspaces/WS-1",
    });

    expect(ws.workspace_shorthand).toBe("WS-1");
    expect(ws.name).toBe("T-1 attempt");
    expect(ws.branch).toBe("workspace/WS-1");
  });

  test("createStandalone increments the WS- shorthand per project", async () => {
    const ws1 = await workspacesService.createStandalone({ project_id: projectId });
    const ws2 = await workspacesService.createStandalone({ project_id: projectId });

    expect(ws1.workspace_shorthand).toBe("WS-1");
    expect(ws2.workspace_shorthand).toBe("WS-2");
  });

  test("createDefault creates a single root workspace marked is_default", async () => {
    const ws = await workspacesService.createDefault({
      project_id: projectId,
      name: "prompt-studio",
      branch: "main",
    });

    expect(ws.is_default).toBe(true);
    expect(ws.name).toBe("prompt-studio");
    expect(ws.branch).toBe("main");
    expect(ws.worktree_path).toBeNull();
  });

  test("getDefault returns the default workspace or null", async () => {
    expect(await workspacesService.getDefault(projectId)).toBeNull();

    const ws = await workspacesService.createDefault({
      project_id: projectId,
      name: "prompt-studio",
      branch: "main",
    });

    const found = await workspacesService.getDefault(projectId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(ws.id);
    expect(found!.is_default).toBe(true);
  });

  test("enforces one default workspace per project", async () => {
    const first = await workspacesService.createDefault({
      project_id: projectId,
      name: "prompt-studio",
      branch: "main",
    });

    await expect(
      (async () => {
        await db.insert(workspaces).values({
          ...first,
          id: crypto.randomUUID(),
          name: "another default",
          workspace_shorthand: "another-default",
        });
      })(),
    ).rejects.toThrow();
  });
});

describe("createWorkspacesDBService lookups and mutations", () => {
  test("getByShorthand returns workspace or null", async () => {
    await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });

    const found = await workspacesService.getByShorthand(projectId, "PS-1_A1");
    expect(found).not.toBeNull();
    expect(found!.workspace_shorthand).toBe("PS-1_A1");

    const notFound = await workspacesService.getByShorthand(projectId, "PS-1_A99");
    expect(notFound).toBeNull();
  });

  test("softDelete hides workspace from list", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });

    await workspacesService.softDelete(ws.id);

    const list = await workspacesService.list(projectId);
    expect(list.length).toBe(0);

    const found = await workspacesService.getByShorthand(projectId, ws.workspace_shorthand);
    expect(found).toBeNull();
  });

  test("archive marks workspace as archived and hides it from list", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
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
    const ws1 = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    await workspacesService.softDelete(ws1.id);

    const ws2 = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });

    expect(ws2.workspace_shorthand).toBe("PS-1_A2");
  });

  test("orphaned workspaces count toward shorthand sequence", async () => {
    const timestamp = new Date().toISOString();
    await db.insert(workspaces).values({
      id: crypto.randomUUID(),
      project_id: projectId,
      name: "PS-1_A1",
      branch: null,
      worktree_path: null,
      archived: false,
      workspace_shorthand: "PS-1_A1",
      initializing: false,
      setup_error: null,
      startup_log_file_id: null,
      anchors_json: [ticketAnchor],
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });

    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });

    expect(ws.workspace_shorthand).toBe("PS-1_A2");
  });

  test("provider projections preserve omitted references and operations", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      provider_id: "example.remote",
      provider_state: "provisioning",
      provider_operation_id: "op-create-1",
      provider_operation_kind: "create",
    });
    await workspacesService.updateProviderProjection(ws.id, {
      provider_state: "provisioning",
      execution_kind: "remote",
      provider_ref_json: { version: 1, data: { remoteId: "remote-1" } },
      provider_capabilities_json: ws.provider_capabilities_json,
    });

    await workspacesService.updateProviderProjection(ws.id, {
      provider_state: "provisioning",
      execution_kind: "remote",
      provider_capabilities_json: ws.provider_capabilities_json,
    });

    const found = await workspacesService.get(ws.id);
    expect(found?.provider_ref_json).toEqual({ version: 1, data: { remoteId: "remote-1" } });
    expect(found?.provider_operation_id).toBe("op-create-1");
    expect(found?.provider_operation_kind).toBe("create");
  });

  test("provider reconciliation reads archived rows with pending operations", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      provider_id: "example.remote",
      provider_state: "archiving",
      provider_operation_id: "op-archive-1",
      provider_operation_kind: "archive",
    });
    await workspacesService.archive(ws.id);

    expect(await workspacesService.list(projectId)).toEqual([]);
    expect((await workspacesService.listForProviderReconciliation(projectId)).map((row) => row.id)).toContain(ws.id);
  });
});
