import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { createTestHarnessRegistry, testHarnessId } from "../../harnesses/test-harness-registry";

test("renaming a session changes its title without changing its conversation or status", async () => {
  const root = mkdtempSync(join(tmpdir(), "rename-session-"));
  const handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(root, "storage"),
    harnessRegistry: createTestHarnessRegistry([]),
  });
  try {
    const projectResponse = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Rename session" })),
    });
    const project = await projectResponse.json();
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Original",
      agent: testHarnessId("fake"),
    });
    const response = await handle.app.request(`/v1/sessions/${session.id}/title`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "  New title  " }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: session.id, title: "New title", status: session.status });
    const saved = await handle.deps.sessionService.get(session.id);
    expect(saved).toMatchObject({ title: "New title", session_file_id: session.session_file_id, agent: session.agent });
    const invalid = await handle.app.request(`/v1/sessions/${session.id}/title`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "  " }),
    });
    expect(invalid.status).toBe(400);
    expect((await handle.deps.sessionService.get(session.id))?.title).toBe("New title");
  } finally {
    await handle.close();
    rmSync(root, { recursive: true, force: true });
  }
});
