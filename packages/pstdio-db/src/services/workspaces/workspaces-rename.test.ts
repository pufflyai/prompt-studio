import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
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

  const projectsService = createProjectsDBService(db);
  const project = await projectsService.create({ name: "prompt-studio" });
  projectId = project.id;

  workspacesService = createWorkspacesDBService(db);
};

beforeEach(setup);

afterEach(async () => {
  await close?.();
});

describe("createWorkspacesDBService rename", () => {
  test("trims the display name and preserves stable workspace fields", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
      branch: "workspace/PS-1_A1",
      worktree_path: "/repo/.pstdio/workspaces/PS-1_A1",
    });

    const renamed = await workspacesService.rename(ws.id, "  Spike - API only  ");

    expect(renamed).not.toBeNull();
    expect(renamed!.name).toBe("Spike - API only");
    expect(renamed!.id).toBe(ws.id);
    expect(renamed!.workspace_shorthand).toBe(ws.workspace_shorthand);
    expect(renamed!.branch).toBe(ws.branch);
    expect(renamed!.worktree_path).toBe(ws.worktree_path);
    expect(renamed!.updated_at).not.toBe(ws.updated_at);
  });

  test("returns null for missing, archived, or deleted workspaces", async () => {
    const archived = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    await workspacesService.archive(archived.id);

    const deleted = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    await workspacesService.softDelete(deleted.id);

    expect(await workspacesService.rename("missing", "New name")).toBeNull();
    expect(await workspacesService.rename(archived.id, "New name")).toBeNull();
    expect(await workspacesService.rename(deleted.id, "New name")).toBeNull();
  });

  test("rejects blank, too long, and duplicate active names without mutating", async () => {
    const first = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    const second = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    await workspacesService.rename(first.id, "Spike - API only");
    const before = await workspacesService.get(second.id);

    await expect(workspacesService.rename(second.id, "   ")).rejects.toThrow("Workspace name is required");
    await expect(workspacesService.rename(second.id, "x".repeat(121))).rejects.toThrow(
      "Workspace name must be 120 characters or less",
    );
    await expect(workspacesService.rename(second.id, "Spike - API only")).rejects.toThrow(
      "Workspace name already exists",
    );

    const after = await workspacesService.get(second.id);
    expect(after!.name).toBe(before!.name);
    expect(after!.updated_at).toBe(before!.updated_at);
  });

  test("allows reusing an archived workspace name", async () => {
    const archived = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });
    await workspacesService.rename(archived.id, "Spike - API only");
    await workspacesService.archive(archived.id);

    const active = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      anchors: [ticketAnchor],
    });

    const renamed = await workspacesService.rename(active.id, "Spike - API only");

    expect(renamed!.name).toBe("Spike - API only");
  });

  test("rejects default workspace rename", async () => {
    const workspace = await workspacesService.createDefault({
      project_id: projectId,
      name: "prompt-studio",
      branch: "main",
    });
    const before = await workspacesService.get(workspace.id);

    await expect(workspacesService.rename(workspace.id, "New root label")).rejects.toThrow(
      "Default workspace cannot be renamed",
    );

    const after = await workspacesService.get(workspace.id);
    expect(after!.name).toBe(before!.name);
    expect(after!.updated_at).toBe(before!.updated_at);
  });
});
