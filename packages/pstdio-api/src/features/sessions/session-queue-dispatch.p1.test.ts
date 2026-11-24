import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import type { HarnessStartInput } from "pstdio-api-contracts";

import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { dispatchQueuedEntry } from "./session-queue-dispatch";

test.each(["start", "follow_up", "resume"])("keeps a queued %s for retry when startup is not ready", async (kind) => {
  let starts = 0;
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("retry", {
      provider: {
        start: async () => {
          starts += 1;
          return { agentSessionId: "accepted", done: new Promise(() => {}), stop: () => {} };
        },
        resume: async () => {
          starts += 1;
          return { agentSessionId: "accepted", done: new Promise(() => {}), stop: () => {} };
        },
        getMessages: () => [],
      },
    }),
  ]);
  const app = await createTestApp({ harnessRegistry: registry });
  try {
    const project = await app.deps.projectService.create({ name: "Retry queued work" });
    const workspace = await app.deps.workspaceService.createStandalone({
      project_id: project.id,
      provider_state: "provisioning",
    });
    const session = await app.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Pending work",
        agent: testHarnessId("retry"),
        prompt: "keep this prompt",
        request_kind: kind === "start" ? "start" : "follow_up",
      },
      { emitStartedHook: false },
    );
    if (kind === "resume") await app.deps.sessionService.update(session.id, { agent_session_id: "previous" });
    await app.deps.workspaceSessionService.link(workspace.id, session.id);
    const dispatch = async () => {
      const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
      await dispatchQueuedEntry(app.deps, (await app.deps.sessionService.get(session.id))!, entry!);
    };
    await dispatch();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await app.deps.sessionService.get(session.id))?.status === "queued") break;
      await Bun.sleep(10);
    }
    expect(starts).toBe(0);
    expect(await app.deps.sessionService.get(session.id)).toMatchObject({ status: "queued" });
    expect(await app.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toHaveLength(1);
    await app.deps.workspaceService.updateProviderProjection(workspace.id, {
      provider_state: "ready",
      execution_kind: "local",
      root_path: tmpdir(),
      provider_capabilities_json: workspace.provider_capabilities_json,
    });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (starts === 1 && (await app.deps.sessionQueueEntriesService.listDispatchStarted()).length === 0) break;
      await Bun.sleep(10);
    }
    expect(starts).toBe(1);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
  } finally {
    await app.close();
  }
});

test("dispatch uses the saved request model and complete parameters after the draft selection changes", async () => {
  const started = Promise.withResolvers<HarnessStartInput>();
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("saved-settings", {
        provider: {
          params: {
            thinking: {
              type: "select",
              defaultValue: "low",
              options: [
                { label: "Low", value: "low" },
                { label: "High", value: "high" },
              ],
            },
            safe: { type: "boolean", defaultValue: true },
          },
          listModels: () => [{ id: "saved" }, { id: "draft" }],
          start: (_ctx, input) => {
            started.resolve(input);
            return { agentSessionId: "accepted", done: new Promise(() => {}), stop: () => {} };
          },
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Saved settings" });
    const session = await app.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Saved settings",
        agent: testHarnessId("saved-settings"),
        prompt: "Saved",
        request_kind: "start",
        last_selected_model: "saved",
        params_json: { thinking: "high", safe: false },
      },
      { emitStartedHook: false },
    );
    await app.deps.sessionService.update(session.id, {
      last_selected_model: "draft",
      params_json: { thinking: "low", safe: true },
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    const result = await dispatchQueuedEntry(app.deps, (await app.deps.sessionService.get(session.id))!, entry);
    await result?.settled;
    const input = await started.promise;
    expect(input.model).toBe("saved");
    expect(input.params).toEqual({ thinking: "high", safe: false });
  } finally {
    await app.close();
  }
});

test("dispatches reordered follow-ups in their saved queue order", async () => {
  const dispatched: string[] = [];
  const bothDispatched = Promise.withResolvers<void>();
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("queue-order", {
        provider: {
          resume: (_ctx, input) => {
            dispatched.push(input.prompt);
            if (dispatched.length === 2) bothDispatched.resolve();
            return {
              agentSessionId: input.agentSessionId,
              done: Promise.resolve({ status: "completed" }),
              stop: () => {},
            };
          },
          getMessages: () => [],
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Queue order" });
    const session = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Active turn",
      agent: testHarnessId("queue-order"),
      cwd: tmpdir(),
    });
    await app.deps.sessionService.update(session.id, { agent_session_id: "active" });
    const queue = app.deps.sessionQueueEntriesService;
    const first = await queue.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "First",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    await queue.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "Second",
      created_at: "2026-01-01T00:00:01.000Z",
    });
    const response = await app.app.request(
      `/v1/sessions/${session.id}/queued-follow-ups/${first.queue_position}/move`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ direction: "down" }),
      },
    );
    expect(response.status).toBe(200);
    expect((await queue.listPendingBySession(session.id)).map((entry) => entry.prompt)).toEqual(["Second", "First"]);

    await app.deps.sessionService.transitionStatus(session.id, "completed");
    await bothDispatched.promise;
    expect(dispatched).toEqual(["Second", "First"]);
  } finally {
    await app.close();
  }
});
