import { afterEach, expect, test } from "bun:test";
import { createDb, createProjectsDBService, createSessionsDBService, createWorkspacesDBService } from "pstdio-db";
import { createSessionService } from "../../../services/session-service";
import { createWorkspaceService } from "../../../services/workspace-service";
import { EventBus } from "../../sync/event-bus";
import { createSessionsApi } from "./sessions";
import { createWorkspacesApi } from "./workspaces";

let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

const setup = async () => {
  const connection = await createDb({ path: ":memory:" });
  close = connection.close;
  const projects = createProjectsDBService(connection.db);
  const project = await projects.create({ name: "Anchors" });
  const other = await projects.create({ name: "Other" });
  const eventBus = new EventBus();
  const workspaceService = createWorkspaceService({ workspacesDb: createWorkspacesDBService(connection.db), eventBus });
  const sessionService = createSessionService({ sessionsDb: createSessionsDBService(connection.db), eventBus });
  const deps = { workspaceService, sessionService } as never;
  return {
    project,
    other,
    eventBus,
    workspaceService,
    sessionService,
    workspaces: createWorkspacesApi(deps, { projectId: project.id }, {} as never),
    sessions: createSessionsApi(deps, {
      projectId: project.id,
      project: { id: project.id, name: project.name, shorthand: "AN" },
    }),
  };
};

for (const target of ["workspace", "session"] as const) {
  test(`${target} anchors merge, replace and remove by resource identity within the project`, async () => {
    const env = await setup();
    const create = async (projectId: string) =>
      target === "workspace"
        ? env.workspaceService.create({ project_id: projectId })
        : env.sessionService.create({ project_id: projectId, title: "Anchors", agent: "test" });
    const api = target === "workspace" ? env.workspaces : env.sessions;
    const owned = await create(env.project.id);
    const foreign = await create(env.other.id);
    const first = { type: "ticket", id: "one", label: "First" };
    const second = { type: "ticket", id: "two" };
    const differentType = { type: "document", id: "one" };
    await api.addAnchors(owned.id, [first, second, differentType]);
    const replacement = { ...first, label: "Updated" };
    await api.addAnchors(owned.id, [replacement, replacement]);
    expect((await api.get(owned.id))?.anchors_json).toEqual([replacement, second, differentType]);
    await api.removeAnchors(owned.id, [first]);
    await api.removeAnchors(owned.id, [first]);
    expect((await api.get(owned.id))?.anchors_json).toEqual([second, differentType]);
    await expect(api.addAnchors(foreign.id, [first])).rejects.toThrow("not found");
    await expect(api.removeAnchors(foreign.id, [first])).rejects.toThrow("not found");
    await expect(api.addAnchors("missing", [first])).rejects.toThrow("not found");
    await expect(api.removeAnchors("missing", [first])).rejects.toThrow("not found");
    expect(env.eventBus.getSince(0).at(-1)).toMatchObject({
      table: target === "workspace" ? "workspaces" : "sessions",
      op: "set",
      data: { id: owned.id, anchors_json: [second, differentType] },
    });
  });
}

for (const target of ["workspace", "session"] as const) {
  test(`${target} preserves concurrent anchor changes`, async () => {
    const env = await setup();
    const resource =
      target === "workspace"
        ? await env.workspaceService.create({ project_id: env.project.id })
        : await env.sessionService.create({ project_id: env.project.id, title: "Concurrent", agent: "test" });
    const api = target === "workspace" ? env.workspaces : env.sessions;
    const one = { type: "ticket", id: "one" };
    const two = { type: "ticket", id: "two" };
    const three = { type: "ticket", id: "three" };
    await Promise.all([api.addAnchors(resource.id, [one]), api.addAnchors(resource.id, [two])]);
    const linked = (await api.get(resource.id))?.anchors_json;
    expect(linked).toHaveLength(2);
    expect(linked).toEqual(expect.arrayContaining([one, two]));
    await Promise.all([api.removeAnchors(resource.id, [one]), api.addAnchors(resource.id, [three])]);
    expect((await api.get(resource.id))?.anchors_json).toEqual([two, three]);
    await Promise.all([api.removeAnchors(resource.id, [two]), api.removeAnchors(resource.id, [three])]);
    expect((await api.get(resource.id))?.anchors_json).toEqual([]);
  });
}

for (const target of ["workspace", "session"] as const) {
  test(`${target} skips unchanged anchor removals`, async () => {
    const env = await setup();
    const resource =
      target === "workspace"
        ? await env.workspaceService.create({ project_id: env.project.id })
        : await env.sessionService.create({ project_id: env.project.id, title: "Unchanged", agent: "test" });
    const api = target === "workspace" ? env.workspaces : env.sessions;
    const service = target === "workspace" ? env.workspaceService : env.sessionService;
    const anchor = { type: "ticket", id: "one" };
    await api.addAnchors(resource.id, [anchor]);
    const before = await service.get(resource.id);
    const sequence = env.eventBus.seq;
    await api.removeAnchors(resource.id, []);
    await api.removeAnchors(resource.id, [
      { type: "ticket", id: "missing" },
      { type: "document", id: "one" },
    ]);
    expect(await service.get(resource.id)).toEqual(before);
    expect(env.eventBus.getSince(sequence)).toEqual([]);

    await Promise.all([api.removeAnchors(resource.id, [anchor]), api.removeAnchors(resource.id, [anchor])]);
    expect((await api.get(resource.id))?.anchors_json).toEqual([]);
    expect(env.eventBus.getSince(sequence)).toHaveLength(1);
    const removed = await service.get(resource.id);
    await api.removeAnchors(resource.id, [anchor]);
    expect(await service.get(resource.id)).toEqual(removed);
    expect(env.eventBus.getSince(sequence)).toHaveLength(1);
  });
}
