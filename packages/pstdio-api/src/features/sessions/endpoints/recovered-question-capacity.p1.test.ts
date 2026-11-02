import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("recovered question replies respect the workspace limit", async () => {
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("fake", {
        provider: {
          start: () => ({ agentSessionId: crypto.randomUUID(), done: new Promise(() => {}), stop: () => {} }),
          resume: () => ({ agentSessionId: "thread", done: new Promise(() => {}), stop: () => {} }),
          getMessages: () => [],
        },
      }),
    ]),
  });
  const request = async (path: string, body: unknown, method = "POST") => {
    const response = await app.app.request(`/v1/${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return response.json();
  };
  try {
    const a = await request("projects", folderProjectInput({ name: "A" }));
    const b = await request("projects", folderProjectInput({ name: "B" }));
    const ended = await request("sessions", {
      project_id: a.id,
      title: "Previously ended",
      agent: testHarnessId("fake"),
    });
    await app.deps.sessionService.update(ended.id, { agent_session_id: "thread" });
    await request("workspaces/capacity", { limit: 1 }, "PATCH");
    const holder = await request("sessions", {
      project_id: b.id,
      title: "Occupies slot",
      prompt: "Work",
      agent: testHarnessId("fake"),
    });
    const result = await request(`sessions/${ended.id}/follow-up`, {
      prompt: "Answer",
      question_response: { callId: "q1", answers: [["Yes"]] },
    });
    expect(result.follow_up.status).toBe("queued");
    expect((await app.deps.workspaceCapacityService.get()).activeCount).toBe(1);
    const entries = await app.deps.sessionQueueEntriesService.listPendingBySession(ended.id);
    expect(entries[0]?.question_response_json).toEqual({ callId: "q1", answers: [["Yes"]] });
    await app.deps.sessionService.transitionStatus(holder.id, "completed");
    expect((await app.deps.sessionService.get(ended.id))?.status).toBe("in_progress");
    expect((await app.deps.workspaceCapacityService.get()).activeCount).toBe(1);
  } finally {
    await app.close();
  }
});
