import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";

test("HTTP links host resources with project scope and preserves links in sync snapshots", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Links" });
    const other = await app.deps.projectService.create({ name: "Other" });
    const first = await app.deps.workspaceService.createStandalone({ project_id: project.id });
    const second = await app.deps.workspaceService.createStandalone({ project_id: project.id });
    const foreign = await app.deps.workspaceService.createStandalone({ project_id: other.id });
    const request = async (operation: string, body: unknown) => {
      const response = await app.app.request(`/v1/projects/${project.id}/resource-anchors/${operation}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(result));
      return result;
    };
    const source = { type: "workspace", id: first.id };
    const target = { type: "workspace", id: second.id, role: "result" as const };
    await request("add", { resource: source, anchors: [target] });
    expect((await request("query", { resource: target, direction: "incoming" })).items).toHaveLength(1);
    const state = await app.deps.syncService.getFullState();
    expect(state.workspaces).toContainEqual(
      expect.objectContaining({ id: first.id, anchors_json: [expect.objectContaining(target)] }),
    );
    await expect(request("add", { resource: source, anchors: [{ ...target, id: foreign.id }] })).rejects.toThrow(
      "another project",
    );
    await expect(request("query", { resource: source, limit: 101 })).rejects.toThrow();
    await request("remove", { resource: source, refs: [target] });
    expect((await request("query", { resource: source })).items).toEqual([]);
  } finally {
    await app.close();
  }
});

test("canonical link pages use a terminal null and retain the deprecated cursor shape", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Link pages" });
    const workspace = await handle.deps.workspaceService.createStandalone({ project_id: project.id });
    const path = `/v1/projects/${project.id}/resource-anchors`;
    const init = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: { type: "workspace", id: workspace.id } }),
    };
    const response = await handle.app.request(`${path}/query-page`, init);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
    expect(await (await handle.app.request(`${path}/query`, init)).json()).toEqual({ items: [] });
    const notifications = await (await handle.app.request(`/v1/projects/${project.id}/notifications`)).json();
    expect(notifications).toEqual({ items: [], nextCursor: null });
  } finally {
    await handle.close();
  }
});
