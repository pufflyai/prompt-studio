import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";

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
