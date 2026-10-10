import { afterEach, describe, expect, test } from "bun:test";
import type { HarnessStartInput } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { createSessionScheduler } from "../session-scheduler";
import {
  cleanupSessionAttachmentTestRoots,
  createIsolatedApp,
  createProject,
  FAKE_ID,
  uploadAttachment,
  waitForCompleted,
} from "./session-attachments.test-utils";

afterEach(cleanupSessionAttachmentTestRoots);

const headers = { "content-type": "application/json" };

describe("creating a session before its first message", () => {
  for (const prompt of [undefined, "", "  \n "]) {
    test(`stays inactive with ${prompt === undefined ? "an omitted" : "a blank"} prompt`, async () => {
      const isolated = await createIsolatedApp();
      try {
        const project = await createProject(isolated.app, "Idle session");
        const response = await isolated.app.request("/v1/sessions", {
          method: "POST",
          headers,
          body: JSON.stringify({ project_id: project.id, title: "Connection", agent: FAKE_ID, prompt }),
        });
        expect(response.status).toBe(201);
        const session = await response.json();
        expect(session).toMatchObject({
          status: "completed",
          agent: FAKE_ID,
          agent_session_id: null,
          last_request_started: null,
          last_request_ended: null,
        });
        expect(isolated.harness.start).not.toHaveBeenCalled();
        expect(await isolated.deps.sessionService.countActive()).toBe(0);
        expect(await isolated.deps.sessionQueueEntriesService.listPending()).toEqual([]);
        expect(await isolated.deps.workspaceSessionService.getWorkspaceBySessionId(session.id)).not.toBeNull();
        const conversation = await isolated.app.request(`/v1/sessions/${session.id}/conversation`);
        expect(conversation.status).toBe(200);
        expect((await conversation.json()).messages).toEqual([]);

        const followup = await isolated.app.request(`/v1/sessions/${session.id}/follow-up`, {
          method: "POST",
          headers,
          body: JSON.stringify({ prompt: "First message" }),
        });
        expect(followup.status).toBe(200);
        await waitForCompleted(isolated.app, session.id);
        expect(isolated.harness.start).toHaveBeenCalledTimes(1);
        expect(isolated.harness.start.mock.calls[0]?.[1]).toMatchObject({ prompt: "First message" });
        expect(isolated.harness.resume).not.toHaveBeenCalled();
      } finally {
        await isolated.close();
      }
    });
  }

  test("does not queue empty creation when capacity is full, but queues its first message", async () => {
    const isolated = await createIsolatedApp({ deferExit: true });
    try {
      const project = await createProject(isolated.app, "Full capacity");
      await isolated.deps.settingsService.update({ max_concurrent_sessions: 1 });
      const active = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({ project_id: project.id, title: "Working", agent: FAKE_ID, prompt: "Work" }),
      });
      expect(active.status).toBe(201);
      const response = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({ project_id: project.id, title: "Idle", agent: FAKE_ID }),
      });
      expect(response.status).toBe(201);
      const session = await response.json();
      expect(session.status).toBe("completed");
      expect(await isolated.deps.sessionQueueEntriesService.listPending()).toEqual([]);
      expect(isolated.harness.start).toHaveBeenCalledTimes(1);

      const followup = await isolated.app.request(`/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: "First queued message" }),
      });
      expect(followup.status).toBe(200);
      expect(await followup.json()).toMatchObject({ status: "queued", follow_up: { status: "queued" } });
      isolated.harness.completeAll();
      for (let attempt = 0; attempt < 30 && isolated.harness.start.mock.calls.length < 2; attempt += 1) {
        await Bun.sleep(20);
      }
      expect(isolated.harness.start).toHaveBeenCalledTimes(2);
      expect(isolated.harness.start.mock.calls[1]?.[1]).toMatchObject({ prompt: "First queued message" });
      expect(isolated.harness.resume).not.toHaveBeenCalled();
      isolated.harness.completeAll();
      await waitForCompleted(isolated.app, session.id);
    } finally {
      isolated.harness.completeAll();
      await isolated.close();
    }
  });

  test("starts an attachment-only first turn", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Attachment-only session");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "input.txt",
        content: "Work from this file",
        type: "text/plain",
      });
      const response = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          project_id: project.id,
          title: "File input",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(response.status).toBe(201);
      const session = await response.json();
      await waitForCompleted(isolated.app, session.id);
      expect(isolated.harness.start).toHaveBeenCalledTimes(1);
      expect(isolated.harness.start.mock.calls[0]?.[1]).toMatchObject({
        prompt: "",
        attachments: [expect.objectContaining({ fileId: attachment.file_id })],
      });
    } finally {
      await isolated.close();
    }
  });
});

for (const queued of [false, true]) {
  test(`switching harness for the first ${queued ? "queued" : "immediate"} message uses its own parameters`, async () => {
    const starts: HarnessStartInput[] = [];
    const original = createTestHarnessRecord("original", {
      provider: { params: { safe: { type: "boolean", required: true } } },
    });
    const replacement = createTestHarnessRecord("replacement", {
      provider: {
        start: (_ctx, input) => {
          starts.push(input);
          return { done: Promise.resolve({ status: "completed" }), stop: () => {} };
        },
      },
    });
    const isolated = await createTestApp({ harnessRegistry: createTestHarnessRegistry([original, replacement]) });
    try {
      const project = await createProject(isolated.app, "First message harness switch");
      const response = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          project_id: project.id,
          title: "Idle with original parameters",
          agent: original.id,
          params: { safe: true },
        }),
      });
      expect(response.status).toBe(201);
      const session = await response.json();
      if (queued) {
        await isolated.deps.settingsService.update({ max_concurrent_sessions: 1 });
        await isolated.deps.sessionService.create(
          { project_id: project.id, title: "Reserved capacity", agent: original.id },
          { emitStartedHook: false },
        );
      }
      const followup = await isolated.app.request(`/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: "First switched message", agent: replacement.id }),
      });
      expect(followup.status).toBe(200);
      if (queued) {
        expect((await followup.json()).status).toBe("queued");
        await isolated.deps.settingsService.update({ max_concurrent_sessions: null });
        await createSessionScheduler(isolated.deps).drainQueue();
      }
      await waitForCompleted(isolated.app, session.id);
      expect(starts).toHaveLength(1);
      expect(starts[0]?.prompt).toBe("First switched message");
      expect(Object.keys(starts[0]?.params ?? {})).toEqual([]);
    } finally {
      await isolated.close();
    }
  });
}
