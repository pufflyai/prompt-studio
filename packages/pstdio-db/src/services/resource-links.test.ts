import { expect, test } from "bun:test";
import { createDb } from "../db/connection.pglite";
import { createProjectsDBService } from "./projects/projects";
import { createResourceLinksDBService } from "./resource-links";

test("directed resource links separate owners, preserve metadata, paginate and clean up both endpoints", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Links" });
    const links = createResourceLinksDBService(connection.db);
    const source = { projectId: project.id, extensionId: "example.notes", type: "item", id: "one" };
    const target = { ...source, extensionId: "example.art", metadata: { revision: 2 }, role: "result" as const };
    expect(await links.add(source, [target])).toHaveLength(1);
    expect(await links.add(source, [target])).toEqual([]);
    expect((await links.list({ resource: target, direction: "incoming" })).items).toEqual([{ source, target }]);
    await Promise.all([links.add(source, [{ ...target, id: "two" }]), links.add(source, [{ ...target, id: "three" }])]);
    const first = await links.list({ resource: source, limit: 2 });
    expect(first.items).toHaveLength(2);
    const next = await links.list({ resource: source, cursor: first.nextCursor, limit: 2 });
    expect(next.items).toHaveLength(1);
    expect(new Set([...first.items, ...next.items].map(({ target }) => target.id)).size).toBe(3);
    expect(await links.add(source, [{ ...target, role: "source" }])).toHaveLength(1);
    expect((await links.list({ resource: source, role: "source" })).items).toHaveLength(1);
    expect(await links.remove(source, [target])).toHaveLength(1);
    expect(await links.remove(source, [target])).toEqual([]);
    expect(await links.removeResource(source)).toHaveLength(2);
    expect((await links.list({ resource: source })).items).toEqual([]);
  } finally {
    await connection.close();
  }
});

test("workspace creation commits links atomically and deletion removes incoming and outgoing links", async () => {
  const { createWorkspacesDBService } = await import("./workspaces/workspaces");
  const connection = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Atomic links" });
    const workspaces = createWorkspacesDBService(connection.db);
    const links = createResourceLinksDBService(connection.db);
    await expect(
      workspaces.createStandalone({
        project_id: project.id,
        anchors: [
          { type: "ticket", id: "one" },
          { type: "item", id: "unknown" },
        ],
      }),
    ).rejects.toThrow("owner");
    expect(await workspaces.list(project.id)).toEqual([]);
    const first = await workspaces.createStandalone({
      project_id: project.id,
      anchors: [{ type: "ticket", id: "one", role: "primary" }],
    });
    const ref = { type: "workspace", id: first.id, projectId: project.id, extensionId: "pstdio" };
    const ticket = { type: "ticket", id: "one", projectId: project.id, extensionId: "pstdio.pstdio-planner" };
    await links.add(ticket, [ref]);
    await workspaces.softDelete(first.id);
    expect((await links.list({ resource: ticket, direction: "both" })).items).toEqual([]);
  } finally {
    await connection.close();
  }
});

test("validated unlink preserves a changed edge and keeps the batch atomic", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Race" });
    const links = createResourceLinksDBService(connection.db);
    const source = { projectId: project.id, extensionId: "example.notes", type: "item", id: "source" };
    const targets = ["one", "two"].map((id) => ({ ...source, id, role: "context" as const }));
    await links.add(source, targets);
    const validated = await links.find(source, targets);
    await links.add(source, [{ ...targets[0]!, role: "result" }]);
    expect(await links.removeValidated(source, targets, validated)).toBeNull();
    expect((await links.list({ resource: source })).items).toHaveLength(2);
    const current = await links.find(source, targets);
    expect(await links.removeValidated(source, targets, current)).toHaveLength(2);
  } finally {
    await connection.close();
  }
});

test("standalone workspace creation returns its committed deduplicated anchors", async () => {
  const { createWorkspacesDBService } = await import("./workspaces/workspaces");
  const connection = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Projection" });
    const service = createWorkspacesDBService(connection.db);
    const anchor = { type: "ticket", id: "one" };
    const created = await service.createStandalone({
      project_id: project.id,
      anchors: [anchor, { ...anchor, role: "result" }],
    });
    expect(created.anchors_json).toHaveLength(1);
    expect(created).toEqual(await service.get(created.id));
  } finally {
    await connection.close();
  }
});

test("host link mutations require a project source and update its timestamp only when links change", async () => {
  const { createWorkspacesDBService } = await import("./workspaces/workspaces");
  const connection = await createDb({ path: ":memory:" });
  try {
    const projects = createProjectsDBService(connection.db);
    const project = await projects.create({ name: "Source rules" });
    const foreign = await projects.create({ name: "Foreign" });
    const workspaces = createWorkspacesDBService(connection.db);
    const workspace = await workspaces.createStandalone({ project_id: project.id });
    const links = createResourceLinksDBService(connection.db);
    const source = { projectId: project.id, extensionId: "pstdio", type: "workspace", id: workspace.id };
    const target = { projectId: project.id, extensionId: "example.notes", type: "item", id: "one" };
    await expect(links.add({ ...source, id: "missing" }, [target])).rejects.toThrow("not found");
    await expect(
      links.add({ ...source, projectId: foreign.id }, [{ ...target, projectId: foreign.id }]),
    ).rejects.toThrow("not found");
    await Bun.sleep(2);
    expect(await links.add(source, [target])).toHaveLength(1);
    const added = (await workspaces.get(workspace.id))!;
    expect(added.updated_at).not.toBe(workspace.updated_at);
    expect(await links.add(source, [target])).toEqual([]);
    expect((await workspaces.get(workspace.id))!.updated_at).toBe(added.updated_at);
    const { projectId: _projectId, ...legacyTarget } = target;
    expect(await workspaces.addAnchors(workspace.id, [legacyTarget])).toBeNull();
    expect((await workspaces.get(workspace.id))!.updated_at).toBe(added.updated_at);
    await expect(links.add(source, [target, { ...target, id: "invalid", projectId: foreign.id }])).rejects.toThrow(
      "another project",
    );
    expect((await links.list({ resource: source })).items).toHaveLength(1);
    expect((await workspaces.get(workspace.id))!.updated_at).toBe(added.updated_at);
    await Bun.sleep(2);
    const validated = await links.find(source, [target]);
    expect(await links.removeValidated(source, [target], validated)).toHaveLength(1);
    expect((await workspaces.get(workspace.id))!.updated_at).not.toBe(added.updated_at);
    await workspaces.softDelete(workspace.id);
    await expect(links.add(source, [target])).rejects.toThrow("not found");
  } finally {
    await connection.close();
  }
});
