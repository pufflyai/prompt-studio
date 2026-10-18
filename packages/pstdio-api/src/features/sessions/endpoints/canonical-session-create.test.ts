import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";

test("session creation accepts canonical project and workspace fields alongside legacy input", async () => {
  const { app, close } = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("local")]),
  });
  try {
    const project = await (
      await app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Canonical sessions" })),
      })
    ).json();
    const workspaces = await (await app.request(`/v1/workspaces?project_id=${project.id}`)).json();
    for (const input of [
      { projectId: project.id, workspaceId: workspaces[0].id, title: "Canonical" },
      { project_id: project.id, workspace_id: workspaces[0].id, title: "Legacy" },
    ]) {
      const response = await app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(201);
      const session = await response.json();
      expect(session.projectId).toBe(project.id);
      expect(session.workspaceId).toBe(workspaces[0].id);
      const current = await (await app.request(`/v1/sessions/${session.id}`)).json();
      const unchanged = await app.request(`/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: current.status }),
      });
      expect(unchanged.status).toBe(200);
      expect(await unchanged.json()).toMatchObject({
        projectId: project.id,
        workspaceId: workspaces[0].id,
        createdAt: session.createdAt,
      });
    }
  } finally {
    await close();
  }
});
