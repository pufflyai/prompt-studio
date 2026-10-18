import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";

test("projects accept camelCase create and update fields with legacy response aliases", async () => {
  const root = mkdtempSync(join(tmpdir(), "project-input-"));
  const { app, close } = await createTestApp();
  const headers = { "content-type": "application/json" };
  try {
    const response = await app.request("/v1/projects", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Canonical project",
        initialWorkspace: { providerId: "pstdio.root", params: { path: root } },
      }),
    });
    expect(response.status).toBe(201);
    const project = await response.json();
    const retried = await app.request(`/v1/projects/${project.id}/retry-setup`, { method: "POST" });
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ projectId: project.id, rootPath: await realpath(root) });
    const updated = await app.request(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ defaultAgentId: "local", defaultAgentModel: "model" }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      defaultAgentId: "local",
      default_agent_id: "local",
      defaultAgentModel: "model",
      default_agent_model: "model",
    });
    const legacy = await app.request(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ default_agent_id: null, default_agent_model: null }),
    });
    expect(await legacy.json()).toMatchObject({ defaultAgentId: null, default_agent_id: null });
  } finally {
    await close();
    rmSync(root, { recursive: true, force: true });
  }
});
