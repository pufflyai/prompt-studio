import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createWorkspacesApi } from "../../extensions/command-environment/workspaces";

test("workspace queries page within a project and keep canonical fields", async () => {
  const { app, deps, close } = await createTestApp();
  try {
    const project = await deps.projectService.create({ name: "Workspace pages" });
    const other = await deps.projectService.create({ name: "Other project" });
    for (let index = 0; index < 52; index++) {
      await deps.workspaceService.create({ project_id: project.id, shorthand_base: `PAGE-${index}` });
    }
    await deps.workspaceService.create({ project_id: other.id, shorthand_base: "OTHER" });
    const response = await app.request(`/v1/projects/${project.id}/workspaces`);
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.items).toHaveLength(50);
    expect(
      first.items.every(
        (item: { projectId: string; project_id: string }) =>
          item.projectId === project.id && item.project_id === project.id,
      ),
    ).toBe(true);
    const last = await (await app.request(`/v1/projects/${project.id}/workspaces?cursor=${first.nextCursor}`)).json();
    expect(last.items).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
    const legacy = await (await app.request(`/v1/workspaces?project_id=${project.id}`)).json();
    const canonical = await (await app.request(`/v1/workspaces?projectId=${project.id}`)).json();
    expect(canonical).toEqual(legacy);
    expect((await app.request(`/v1/workspaces?projectId=${project.id}&project_id=${other.id}`)).status).toBe(400);
    const shorthand = legacy[0].shorthand;
    expect(
      (await app.request(`/v1/workspaces/by-shorthand?projectId=${project.id}&shorthand=${shorthand}`)).status,
    ).toBe(200);
  } finally {
    await close();
  }
});

test("SDK workspace queries scope both link directions before pagination", async () => {
  const { app, deps, close } = await createTestApp();
  try {
    const project = await deps.projectService.create({ name: "Scoped workspaces" });
    const selected = { type: "project", id: project.id, extensionId: "pstdio", projectId: project.id };
    const first = await deps.workspaceService.create({ project_id: project.id, shorthand_base: "FIRST" });
    const second = await deps.workspaceService.create({ project_id: project.id, shorthand_base: "SECOND" });
    await deps.workspaceService.create({ project_id: project.id, shorthand_base: "UNRELATED" });
    await deps.resourceLinksService.add(
      { type: "workspace", id: first.id, extensionId: "pstdio", projectId: project.id },
      [selected],
    );
    await deps.resourceLinksService.add(selected, [
      { type: "workspace", id: second.id, extensionId: "pstdio", projectId: project.id },
    ]);
    const { createClient } = await import("@pstdio/sdk/client");
    const client = createClient({
      baseUrl: "http://localhost",
      fetch: Object.assign(
        (input: URL | RequestInfo, init?: RequestInit) =>
          Promise.resolve(app.request(input instanceof Request ? input : String(input), init)),
        { preconnect() {} },
      ),
    });
    const contextApi = createWorkspacesApi(deps, { projectId: project.id }, {} as never);
    await expect(contextApi.query({ anchors: Array.from({ length: 101 }, () => selected) })).rejects.toThrow();
    const page = await client.workspaces.query(project.id, { anchors: [selected], limit: 1 });
    const next = await client.workspaces.query(project.id, { anchors: [selected], limit: 1, cursor: page.nextCursor! });
    expect(new Set([...page.items, ...next.items].map(({ id }) => id))).toEqual(new Set([first.id, second.id]));
    expect(next.nextCursor).toBeNull();
    expect((await client.workspaces.query(project.id, { anchors: [] })).items).toEqual([]);
    expect(
      (await client.workspaces.query(project.id, { anchors: [{ ...selected, extensionId: "other.owner" }] })).items,
    ).toEqual([]);
    expect((await app.request(`/v1/projects/${project.id}/workspaces?anchors=invalid`)).status).toBe(400);
  } finally {
    await close();
  }
});
