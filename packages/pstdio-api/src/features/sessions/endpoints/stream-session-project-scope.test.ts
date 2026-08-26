import { expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-api-contracts";
import { createApp } from "../../../app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const AGENT_ID = testHarnessId("fake");

test("completed session replay does not use a host-wide harness disabled for the project", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-stream-project-harness-scope-test-"));
  const disabledProjects = new Set<string>();
  const hostMessage: SessionMessage = {
    id: "host-message",
    role: "assistant",
    parts: [{ type: "text", text: "host-wide message" }],
  };
  const getMessages = mock(() => [hostMessage]);
  const baseRegistry = createTestHarnessRegistry([createTestHarnessRecord("fake", { provider: { getMessages } })]);
  const get = mock(async (id: string, scope?: { projectId?: string }) => {
    if (scope?.projectId && disabledProjects.has(scope.projectId)) return null;
    return baseRegistry.get(id, scope);
  });
  const handle = await createApp({
    dbPath: ":memory:",
    extensionWebviewBuilds: false,
    filesRoot: "",
    harnessRegistry: { ...baseRegistry, get },
    storagePath: join(root, "storage"),
  });

  try {
    const projectResponse = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Disabled harness replay project" }),
    });
    expect(projectResponse.status).toBe(201);
    const project = (await projectResponse.json()) as { id: string };
    disabledProjects.add(project.id);

    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Completed host-only session",
      agent: AGENT_ID,
    });
    await handle.deps.sessionService.update(session.id, { agent_session_id: "agent-session-1" });
    await handle.deps.sessionService.transitionStatus(session.id, "completed");

    const response = await handle.app.request(`/v1/sessions/${session.id}/stream`);
    expect(response.status).toBe(200);
    const body = await response.text();

    expect(get).toHaveBeenCalledWith(AGENT_ID, { projectId: project.id });
    expect(getMessages).not.toHaveBeenCalled();
    expect(body).not.toContain("host-wide message");
    expect(body).toContain('"status":"completed"');
  } finally {
    await handle.close();
    rmSync(root, { recursive: true, force: true });
  }
});
