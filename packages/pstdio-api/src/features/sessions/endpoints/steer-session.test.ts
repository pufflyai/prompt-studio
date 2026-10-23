import { expect, test } from "bun:test";
import type { HarnessSteeringInput, HarnessSteeringResult } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { reconcileQueuedSteering } from "../queued-steering";
import { isSessionAttachmentSubmitted } from "../session-attachments";
import { persistSessionMessages } from "../session-messages";

const setup = async (deliver: (input: HarnessSteeringInput) => Promise<HarnessSteeringResult>) => {
  const handle = await createTestApp();
  const project = await handle.deps.projectService.create({ name: "Direct steering" });
  const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Active", agent: "fake" });
  const owner = handle.deps.sessionService.store.create(session.id, {
    onApprovalRequest: () => {},
    onQuestionAsked: () => {},
    onQuestionAnswered: () => {},
  });
  owner.executionSettings = { model: "active-model", params: { thinking: "high" } };
  const conversation = await owner.conversationReady;
  owner.session = {
    done: new Promise(() => {}),
    stop: () => {},
    steer: async (input) => {
      const result = await deliver(input);
      if (result.status === "accepted")
        conversation.push({
          op: "add",
          path: `/messages/${conversation.getMessages().length}`,
          value: {
            id: input.deliveryId,
            role: "user",
            parts: [
              { type: "text", text: input.prompt },
              ...(input.attachments ?? []).map((file) => ({ type: "file" as const, fileId: file.fileId })),
            ],
          },
        });
      return result;
    },
  };
  const send = (input: Record<string, unknown> = {}) =>
    handle.app.request(`/v1/sessions/${session.id}/steer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Focus on tests", expectedRunStartedAt: session.last_request_started, ...input }),
    });
  return { handle, project, session, owner, conversation, send };
};

test("steers a new prompt into the captured active run without making it dispatchable", async () => {
  const received: HarnessSteeringInput[] = [];
  const fixture = await setup(async (input) => {
    received.push(input);
    expect(await fixture.handle.deps.sessionQueueEntriesService.listPending()).toHaveLength(0);
    expect(await fixture.handle.deps.sessionQueueEntriesService.listSteeringDeliveries()).toHaveLength(1);
    return { status: "accepted" };
  });
  try {
    const response = await fixture.send();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "accepted", deliveryId: received[0]?.deliveryId });
    expect(received).toHaveLength(1);
    expect(received[0].prompt).toBe("Focus on tests");
    expect(fixture.conversation.getMessages()).toHaveLength(1);
    expect(await fixture.handle.deps.sessionQueueEntriesService.listPending()).toHaveLength(0);
    expect(await fixture.handle.deps.sessionQueueEntriesService.listSteeringDeliveries()).toHaveLength(0);
    expect((await fixture.handle.deps.sessionService.get(fixture.session.id))!.last_request_started).toBe(
      fixture.session.last_request_started,
    );
    expect(fixture.owner.controlInvocations.size).toBe(0);
  } finally {
    await fixture.handle.close();
  }
});

test.each([
  "inactive",
  "unsupported",
  "stale_run",
  "blocking_input",
] as const)("rejects %s steering without queuing or calling the provider", async (reason) => {
  let calls = 0;
  const fixture = await setup(async () => {
    calls++;
    return { status: "accepted" };
  });
  try {
    if (reason === "inactive")
      await fixture.handle.deps.sessionService.transitionStatus(fixture.session.id, "completed");
    if (reason === "unsupported") fixture.owner.session!.steer = undefined;
    if (reason === "blocking_input")
      await fixture.handle.deps.sessionService.transitionStatus(fixture.session.id, "awaiting_input");
    const response = await fixture.send(reason === "stale_run" ? { expectedRunStartedAt: "old-run" } : {});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "rejected", reason });
    expect(calls).toBe(0);
    expect(await fixture.handle.deps.sessionQueueEntriesService.listUndispatchedBySession(fixture.session.id)).toEqual(
      [],
    );
  } finally {
    await fixture.handle.close();
  }
});

test("definite provider rejection discards a new steering request instead of queuing it", async () => {
  const fixture = await setup(async () => ({ status: "rejected", reason: "Native run ended" }));
  try {
    const response = await fixture.send();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "rejected", reason: "delivery_failed" });
    expect(await fixture.handle.deps.sessionQueueEntriesService.listUndispatchedBySession(fixture.session.id)).toEqual(
      [],
    );
    expect(fixture.conversation.getMessages()).toEqual([]);
  } finally {
    await fixture.handle.close();
  }
});

test.each([
  "cancelled",
  "replaced",
] as const)("a %s run after intent creation rejects without fallback", async (change) => {
  let calls = 0;
  const fixture = await setup(async () => {
    calls++;
    return { status: "accepted" };
  });
  const created = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const queue = fixture.handle.deps.sessionQueueEntriesService;
  const insert = queue.createSteeringDelivery;
  queue.createSteeringDelivery = async (...args) => {
    const entry = await insert(...args);
    created.resolve();
    await release.promise;
    return entry;
  };
  try {
    const response = fixture.send();
    await created.promise;
    expect(fixture.owner.controlInvocations.size).toBe(1);
    if (change === "cancelled") fixture.owner.cancellationRequested = true;
    else await fixture.handle.deps.sessionService.update(fixture.session.id, { last_request_started: "new-run" });
    release.resolve();
    expect(await (await response).json()).toMatchObject({
      status: "rejected",
      reason: change === "cancelled" ? "inactive" : "stale_run",
    });
    expect(calls).toBe(0);
    expect(await queue.listUndispatchedBySession(fixture.session.id)).toEqual([]);
    expect(fixture.owner.controlInvocations.size).toBe(0);
  } finally {
    release.resolve();
    await fixture.handle.close();
  }
});

test("invalid steering attachments reject before creating an intent or calling the provider", async () => {
  let calls = 0;
  const fixture = await setup(async () => {
    calls++;
    return { status: "accepted" };
  });
  try {
    const response = await fixture.send({ attachments: [{ fileId: "missing" }] });
    expect(await response.json()).toMatchObject({ status: "rejected", reason: "invalid_attachments" });
    expect(calls).toBe(0);
    expect(await fixture.handle.deps.sessionQueueEntriesService.listUndispatchedBySession(fixture.session.id)).toEqual(
      [],
    );
    expect(fixture.owner.controlInvocations.size).toBe(0);
  } finally {
    await fixture.handle.close();
  }
});

test("new steering attachments stay protected while preparing their durable intent", async () => {
  const fixture = await setup(async () => ({ status: "accepted" }));
  const release = Promise.withResolvers<void>();
  const reading = Promise.withResolvers<void>();
  try {
    const upload = await fixture.handle.app.request(`/v1/projects/${fixture.project.id}/session-attachments`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-file-name": "notes.txt" },
      body: "Notes",
    });
    const file = await upload.json();
    const get = fixture.handle.deps.fileService.get;
    let intercepted = false;
    fixture.handle.deps.fileService.get = async (...args) => {
      if (args[0] === file.fileId && !intercepted) {
        intercepted = true;
        reading.resolve();
        await release.promise;
      }
      return get(...args);
    };
    const response = fixture.send({ attachments: [{ fileId: file.fileId }] });
    await reading.promise;
    expect(await isSessionAttachmentSubmitted(fixture.handle.deps, fixture.project.id, file.fileId)).toBe(true);
    expect(await fixture.handle.deps.sessionQueueEntriesService.listSteeringDeliveries()).toEqual([]);
    release.resolve();
    expect(await (await response).json()).toMatchObject({ status: "accepted" });
  } finally {
    release.resolve();
    await fixture.handle.close();
  }
});

test("uncertain new steering keeps durable evidence without allowing replay", async () => {
  let deliveryId = "";
  const fixture = await setup(async (input) => {
    deliveryId = input.deliveryId;
    throw new Error("Transport ended after write");
  });
  try {
    const response = await fixture.send();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "uncertain", deliveryId });
    expect(await fixture.handle.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    const [held] = await fixture.handle.deps.sessionQueueEntriesService.listSteeringDeliveries();
    expect(held.steering_delivery_json).toEqual({
      id: deliveryId,
      runStartedAt: fixture.session.last_request_started!,
    });
    expect(await fixture.handle.deps.sessionQueueEntriesService.removePending(held.queue_position)).toBe(false);
    const evidence = [{ id: deliveryId, role: "user" as const, parts: [{ type: "text" as const, text: held.prompt }] }];
    await persistSessionMessages(fixture.session.id, evidence, fixture.handle.deps);
    fixture.handle.deps.sessionService.store.remove(fixture.session.id);
    await reconcileQueuedSteering(fixture.handle.deps, fixture.session.id);
    expect(await fixture.handle.deps.sessionQueueEntriesService.listSteeringDeliveries()).toEqual([]);
  } finally {
    await fixture.handle.close();
  }
});

test("steering accepts canonical attachments and session summaries without changing execution settings", async () => {
  const received: HarnessSteeringInput[] = [];
  const fixture = await setup(async (input) => {
    received.push(input);
    return { status: "accepted" };
  });
  try {
    const source = await fixture.handle.deps.sessionService.create({
      project_id: fixture.project.id,
      title: "Source",
      agent: "fake",
    });
    await persistSessionMessages(
      source.id,
      [{ id: "summary", role: "assistant", parts: [{ type: "text", text: "Review the parser" }] }],
      fixture.handle.deps,
    );
    const upload = await fixture.handle.app.request(`/v1/projects/${fixture.project.id}/session-attachments`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-file-name": "notes.txt" },
      body: "Notes",
    });
    expect(upload.status).toBe(201);
    const attachment = await upload.json();
    const response = await fixture.send({
      summaryFromSessionId: source.id,
      attachments: [{ fileId: attachment.fileId }],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "accepted" });
    expect(received[0].prompt).toContain("Review the parser");
    expect(received[0].attachments).toMatchObject([{ fileId: attachment.fileId }]);
    expect(fixture.owner.executionSettings).toEqual({ model: "active-model", params: { thinking: "high" } });
  } finally {
    await fixture.handle.close();
  }
});
