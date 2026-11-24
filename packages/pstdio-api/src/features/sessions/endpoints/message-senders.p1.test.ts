import { expect, test } from "bun:test";
import type { HarnessExit, HarnessStartInput, SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { getSessionHistory } from "../session-history";
import { dispatchQueuedEntry } from "../session-queue-dispatch";

test.each([false, true])("records a session sender in delivered and saved history (queued: %s)", async (queued) => {
  const finished = Promise.withResolvers<HarnessExit>();
  const echo = (_ctx: unknown, input: HarnessStartInput) => {
    input.events.push({
      op: "add",
      path: "/messages/0",
      value: {
        id: "native-prompt",
        role: "user",
        parts: [{ type: "text", text: input.prompt }],
      },
    });
    return { agentSessionId: "native", done: finished.promise, stop: () => finished.resolve({ status: "cancelled" }) };
  };
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("sender", { provider: { start: echo, getMessages: () => [] } }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Message authors" });
    const source = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Release checks",
      agent: testHarnessId("sender"),
      status: "completed",
    });
    const target = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Receiver",
      agent: testHarnessId("sender"),
      status: queued ? "in_progress" : "completed",
    });
    const sender = { type: "session" as const, id: source.id, name: source.title };
    const res = await app.app.request(`/v1/sessions/${target.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Check the release", source: { type: "session", id: source.id } }),
    });
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.follow_up.status).toBe(queued ? "queued" : "dispatched");
    if (queued) {
      const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(target.id);
      expect(entry!.sender_json).toEqual(sender);
      const snapshot = await app.app.request(`/v1/sessions/${target.id}/queued-messages`);
      expect((await snapshot.json()).messages[0].sender).toEqual(sender);
      await app.deps.sessionService.transitionStatus(target.id, "completed", { drainCapacity: false });
      await app.deps.sessionService.requeueAfterTerminal(target.id);
      await dispatchQueuedEntry(app.deps, { ...target, status: "queued" }, entry!);
    }
    for (let i = 0; i < 100 && !app.deps.sessionService.store.get(target.id)?.conversation?.getMessages().length; i++)
      await Bun.sleep(10);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toContainEqual(
      expect.objectContaining({ session_id: target.id, sender_json: expect.objectContaining(sender) }),
    );
    finished.resolve({ status: "completed" });
    for (let i = 0; i < 100 && (await app.deps.sessionService.get(target.id))?.status !== "completed"; i++)
      await Bun.sleep(10);
    const messages = await getSessionHistory(target.id, app.deps);
    expect(messages[0]).toMatchObject({ role: "user", sender });
    const saved = (await app.deps.sessionService.get(target.id))!;
    expect(saved.session_file_id).toBeString();
    const file = await app.deps.fileService.get(saved.session_file_id!);
    expect(((await Bun.file(file!.storage_path).json()) as SessionMessage[])[0].sender).toMatchObject(sender);
  } finally {
    finished.resolve({ status: "completed" });
    await app.close();
  }
});

test("a source session from another project is never attributed to the local sender", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Local" });
    const foreign = await app.deps.projectService.create({ name: "Other" });
    const source = await app.deps.sessionService.create({ project_id: foreign.id, title: "Private", agent: "fake" });
    const { resolveMessageSender } = await import("../session-message-sender");
    expect(await resolveMessageSender(app.deps, project.id, { type: "session", id: source.id })).toBeUndefined();
    expect(await resolveMessageSender(app.deps, project.id)).toBeUndefined();
  } finally {
    await app.close();
  }
});
