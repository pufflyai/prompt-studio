import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createSessionsApi } from "./sessions";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "session-query-"));
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
});
afterAll(async () => {
  await handle.close();
  rmSync(root, { recursive: true, force: true });
});

test("session readers expose harness and usage through an explicit public mapping", async () => {
  const project = await handle.deps.projectService.create({ name: "session readers" });
  const workspace = await handle.deps.workspaceService.createStandalone({ project_id: project.id });
  const row = await handle.deps.sessionService.create({
    project_id: project.id,
    title: "mapped",
    agent: "claude-code",
  });
  await handle.deps.workspaceSessionService.link(workspace.id, row.id);
  await handle.deps.sessionService.update(row.id, {
    usage_json: { input_tokens: 10, output_tokens: 5, cache_read_tokens: 0, cache_write_tokens: 2 },
  });
  const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "P" } });
  const page = await api.query({ workspaceId: workspace.workspace_shorthand });
  expect(page.items).toHaveLength(1);
  expect(page.items[0]).toMatchObject({
    id: row.id,
    agent: "claude-code",
    workspace_id: workspace.id,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_tokens: 0, cache_write_tokens: 2 },
  });
  expect(await api.get(row.id)).toEqual(page.items[0]);
  expect(await api.list()).toMatchObject([{ id: row.id, agent: "claude-code" }]);
  expect(await api.listByWorkspace(workspace.id)).toEqual(page.items);
  expect(page.items[0]).not.toHaveProperty("project_id");
  expect(page.items[0]).not.toHaveProperty("session_file_id");
  const foreign = await handle.deps.projectService.create({ name: "foreign" });
  const foreignWorkspace = await handle.deps.workspaceService.createStandalone({ project_id: foreign.id });
  await expect(api.query({ workspaceId: foreignWorkspace.id })).rejects.toThrow("Workspace not found");
  const controller = new AbortController();
  controller.abort();
  await expect(
    createSessionsApi(handle.deps, {
      projectId: project.id,
      project: { ...project, shorthand: "P" },
      signal: controller.signal,
    }).query(),
  ).rejects.toThrow();
});

import type { HarnessStartInput } from "pstdio-api-contracts";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import {
  cleanupSessionAttachmentTestRoots,
  createIsolatedApp,
  createProject,
  FAKE_ID,
  waitForCompleted,
} from "../../sessions/endpoints/session-attachments.test-utils";
import { createSessionScheduler } from "../../sessions/session-scheduler";

afterEach(cleanupSessionAttachmentTestRoots);

test("extensions can create and open a session before sending its first message", async () => {
  const isolated = await createIsolatedApp();
  try {
    let startedHooks = 0;
    let resumedHooks = 0;
    const emitStarted = isolated.deps.sessionService.emitStartedHook;
    const emitResumed = isolated.deps.sessionService.emitResumedHook;
    isolated.deps.sessionService.emitStartedHook = (session) => {
      startedHooks++;
      emitStarted(session);
    };
    isolated.deps.sessionService.emitResumedHook = (session) => {
      resumedHooks++;
      emitResumed(session);
    };
    const project = await createProject(isolated.app, "Extension connection");
    const api = createSessionsApi(isolated.deps, {
      projectId: project.id,
      project: { id: project.id, name: "Extension connection", shorthand: "EC" },
    });
    const session = await api.create({ title: "Connect", harness: { harnessId: FAKE_ID } });
    expect(await api.get(session.id)).toMatchObject({
      status: "completed",
      last_request_started: null,
      last_request_ended: null,
    });
    expect(isolated.harness.start).not.toHaveBeenCalled();
    expect(startedHooks).toBe(0);
    expect(resumedHooks).toBe(0);
    expect(await isolated.deps.workspaceSessionService.getWorkspaceBySessionId(session.id)).not.toBeNull();
    await api.followup({ sessionId: session.id, prompt: "Hello from extension" });
    await waitForCompleted(isolated.app, session.id);
    expect(isolated.harness.start).toHaveBeenCalledTimes(1);
    expect(isolated.harness.start.mock.calls[0]?.[1]).toMatchObject({ prompt: "Hello from extension" });
    expect(isolated.harness.resume).not.toHaveBeenCalled();
    expect(startedHooks).toBe(1);
    expect(resumedHooks).toBe(0);
  } finally {
    await isolated.close();
  }
});

for (const queued of [false, true]) {
  test(`the first ${queued ? "queued" : "immediate"} extension message keeps its chosen parameters and model`, async () => {
    const starts: HarnessStartInput[] = [];
    const record = createTestHarnessRecord("configured", {
      provider: {
        params: { safe: { type: "boolean", required: true } },
        listModels: () => [{ id: "chosen-model" }],
        start: (_ctx, input) => {
          starts.push(input);
          return { agentSessionId: "configured-first", done: Promise.resolve({ status: "completed" }), stop: () => {} };
        },
      },
    });
    const isolated = await createTestApp({ harnessRegistry: createTestHarnessRegistry([record]) });
    try {
      const project = await createProject(isolated.app, "Configured idle session");
      const api = createSessionsApi(isolated.deps, {
        projectId: project.id,
        project: { id: project.id, name: "Configured idle session", shorthand: "CI" },
      });
      const session = await api.create({
        title: "Connect with parameters",
        harness: { harnessId: record.id, model: "chosen-model", params: { safe: true } },
      });
      if (queued) {
        await isolated.deps.settingsService.update({ max_concurrent_sessions: 1 });
        await isolated.deps.sessionService.create(
          { project_id: project.id, title: "Reserved capacity", agent: record.id },
          { emitStartedHook: false },
        );
      }
      await api.followup({ sessionId: session.id, prompt: "First configured message" });
      if (queued) {
        expect((await api.get(session.id))?.status).toBe("queued");
        await isolated.deps.settingsService.update({ max_concurrent_sessions: null });
        await createSessionScheduler(isolated.deps).drainQueue();
      }
      await waitForCompleted(isolated.app, session.id);
      expect(starts).toHaveLength(1);
      expect(starts[0]).toMatchObject({
        prompt: "First configured message",
        model: "chosen-model",
        params: { safe: true },
      });
    } finally {
      await isolated.close();
    }
  });
}
