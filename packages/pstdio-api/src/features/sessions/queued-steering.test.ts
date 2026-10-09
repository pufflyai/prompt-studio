import { expect, test } from "bun:test";
import type { HarnessSteeringInput, HarnessSteeringResult } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { reconcileQueuedSteering, steerQueuedFollowUp } from "./queued-steering";
import { isSessionAttachmentSubmitted } from "./session-attachments";
import { checkpointConversation } from "./session-checkpoint";
import { persistSessionMessages } from "./session-messages";

import { withSchedulingLock } from "./session-scheduler-internals";
import { cancelSessionControls } from "./session-store";

const setup = async (deliver: (input: HarnessSteeringInput) => Promise<HarnessSteeringResult>) => {
  const handle = await createTestApp();
  const project = await handle.deps.projectService.create({ name: "Steering" });
  const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Steering", agent: "fake" });
  const owner = handle.deps.sessionService.store.create(session.id, {
    onApprovalRequest: () => {},
    onQuestionAsked: () => {},
    onQuestionAnswered: () => {},
  });
  owner.executionSettings = { model: "model", params: { thinking: "high" } };
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
          value: { id: input.deliveryId, role: "user", parts: [{ type: "text", text: input.prompt }] },
        });
      return result;
    },
  };
  const entry = await handle.deps.sessionQueueEntriesService.create({
    session_id: session.id,
    request_kind: "follow_up",
    prompt: "Correction",
    model: "model",
    params_json: { thinking: "high" },
  });
  const input = { expectedRevision: entry.revision, expectedRunStartedAt: session.last_request_started! };
  return { handle, session, owner, conversation, entry, input };
};

test("accepted steering promotes only the selected revision once and keeps its active run", async () => {
  let calls = 0;
  const { handle, session, entry, input, conversation } = await setup(async () => {
    calls++;
    return { status: "accepted" };
  });
  try {
    const results = await Promise.all([
      steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input),
      steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input),
    ]);
    expect(results.filter((result) => result.status === "accepted")).toHaveLength(1);
    expect(calls).toBe(1);
    expect(conversation.getMessages()).toHaveLength(1);
    expect(await handle.deps.sessionQueueEntriesService.get(entry.queue_position)).toBeNull();
    expect((await handle.deps.sessionService.get(session.id))!.last_request_started).toBe(session.last_request_started);
  } finally {
    await handle.close();
  }
});

test("definite rejection keeps the request pending; uncertain delivery excludes replay and mutations", async () => {
  const { handle, session, entry, input, owner } = await setup(async () => ({
    status: "rejected",
    reason: "Provider declined",
  }));
  try {
    expect((await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input)).status).toBe("rejected");
    expect(await handle.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toHaveLength(1);
    owner.session!.steer = async () => {
      throw new Error("Connection lost after write");
    };
    const result = await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input);
    expect(result.status).toBe("uncertain");
    expect(await handle.deps.sessionQueueEntriesService.listPending()).toHaveLength(0);
    expect(
      await handle.deps.sessionQueueEntriesService.updatePending(
        entry.queue_position,
        { prompt: "Changed" },
        entry.revision,
      ),
    ).toBeNull();
    expect(await handle.deps.sessionQueueEntriesService.removePending(entry.queue_position)).toBe(false);
    expect((await handle.deps.sessionQueueEntriesService.get(entry.queue_position))!.prompt).toBe("Correction");
  } finally {
    await handle.close();
  }
});

test("stale revisions, run owners, blocking questions, and different settings reject before provider input", async () => {
  let calls = 0;
  const { handle, session, entry, input, owner } = await setup(async () => {
    calls++;
    return { status: "accepted" };
  });
  try {
    expect(
      await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, { ...input, expectedRevision: "stale" }),
    ).toMatchObject({ status: "rejected", reason: "stale_revision" });
    expect(
      await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, {
        ...input,
        expectedRunStartedAt: "stale",
      }),
    ).toMatchObject({ status: "rejected", reason: "stale_run" });
    await handle.deps.sessionQueueEntriesService.updatePending(entry.queue_position, { model: "different" });
    const changed = await handle.deps.sessionQueueEntriesService.get(entry.queue_position);
    expect(
      await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, {
        ...input,
        expectedRevision: changed!.revision,
      }),
    ).toMatchObject({ status: "rejected", reason: "different_settings" });
    const ask = owner.questionService
      .ask({ id: "question", toolUseId: "question", questions: [{ question: "Confirm?" }] })
      .catch(() => {});
    expect(
      await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, {
        ...input,
        expectedRevision: changed!.revision,
      }),
    ).toMatchObject({ status: "rejected", reason: "blocking_input" });
    owner.questionService.dispose();
    await ask;
    expect(calls).toBe(0);
  } finally {
    await handle.close();
  }
});

test("an in-flight delivery holds its owner without blocking other queue coordination and cancellation preserves uncertainty", async () => {
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<HarnessSteeringResult>();
  const { handle, session, entry, input, owner } = await setup(async (delivery) => {
    started.resolve();
    delivery.signal!.addEventListener(
      "abort",
      () => finish.resolve({ status: "uncertain", reason: "Cancelled after write" }),
      { once: true },
    );
    return finish.promise;
  });
  try {
    const delivery = steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input);
    await started.promise;
    expect(owner.controlInvocations.size).toBe(1);
    let coordinated = false;
    await withSchedulingLock(async () => {
      coordinated = true;
    });
    expect(coordinated).toBe(true);
    cancelSessionControls(owner);
    expect((await delivery).status).toBe("uncertain");
    expect(owner.controlInvocations.size).toBe(0);
    expect(await handle.deps.sessionQueueEntriesService.listPending()).toHaveLength(0);
  } finally {
    await handle.close();
  }
});

test("open approvals prevent live input before the asynchronous status update", async () => {
  let calls = 0;
  const { handle, session, entry, input, owner } = await setup(async () => {
    calls++;
    return { status: "accepted" };
  });
  try {
    const approval = owner.approvalService.requestApproval({
      id: "approval",
      toolName: "shell",
      toolInput: {},
      toolUseId: "approval",
    });
    expect(await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input)).toMatchObject({
      status: "rejected",
      reason: "blocking_input",
    });
    expect(calls).toBe(0);
    owner.approvalService.dispose();
    await approval;
  } finally {
    await handle.close();
  }
});

test("completion checkpoints wait for acceptance and uncertain requests recover only from correlated history", async () => {
  const arrived = Promise.withResolvers<void>();
  const reply = Promise.withResolvers<HarnessSteeringResult>();
  const { handle, session, entry, input, owner } = await setup(async () => {
    arrived.resolve();
    return reply.promise;
  });
  try {
    const delivery = steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input);
    await arrived.promise;
    owner.session = null;
    const checkpoint = checkpointConversation(session.id, owner, handle.deps);
    reply.resolve({ status: "accepted" });
    expect((await delivery).status).toBe("accepted");
    expect(await checkpoint).toHaveLength(1);
    const held = await handle.deps.sessionQueueEntriesService.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "Unconfirmed",
    });
    await handle.deps.sessionQueueEntriesService.claimSteering(held.queue_position, held.revision, {
      id: "correlation",
      runStartedAt: input.expectedRunStartedAt,
    });
    handle.deps.sessionService.store.remove(session.id);
    await reconcileQueuedSteering(handle.deps, session.id);
    expect(await handle.deps.sessionQueueEntriesService.get(held.queue_position)).not.toBeNull();
    await persistSessionMessages(
      session.id,
      [{ id: "correlation", role: "user", parts: [{ type: "text", text: "Unconfirmed" }] }],
      handle.deps,
    );
    await reconcileQueuedSteering(handle.deps, session.id);
    expect(await handle.deps.sessionQueueEntriesService.get(held.queue_position)).toBeNull();
  } finally {
    await handle.close();
  }
});

test("attachments remain protected throughout uncertain native delivery", async () => {
  const { handle, session, entry, input, owner } = await setup(async () => ({
    status: "uncertain",
    reason: "Acknowledgement lost",
  }));
  try {
    const file = await handle.deps.fileService.upload({
      project_id: session.project_id!,
      file_name: "notes.txt",
      file_kind: "session_attachment",
      mime_type: "text/plain",
      data: Buffer.from("notes"),
    });
    const updated = await handle.deps.sessionQueueEntriesService.updatePending(entry.queue_position, {
      attachments_json: [{ file_id: file.id }],
    });
    let delivered: HarnessSteeringInput | undefined;
    owner.session!.steer = async (input) => {
      delivered = input;
      return { status: "uncertain", reason: "Acknowledgement lost" };
    };
    expect(
      (
        await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, {
          ...input,
          expectedRevision: updated!.revision,
        })
      ).status,
    ).toBe("uncertain");
    expect(delivered!.attachments[0].fileId).toBe(file.id);
    expect(await isSessionAttachmentSubmitted(handle.deps, session.project_id!, file.id)).toBe(true);
  } finally {
    await handle.close();
  }
});

test("live async question bubbles remain independent of accepted steering", async () => {
  const { handle, session, entry, input, conversation } = await setup(async () => ({ status: "accepted" }));
  try {
    const question = {
      id: "async-question",
      role: "assistant" as const,
      parts: [
        {
          type: "tool" as const,
          tool: "question",
          callId: "async",
          status: "pending" as const,
          state: { input: { delivery: "async", questions: [{ question: "Optional context?" }] } },
        },
      ],
    };
    conversation.push({ op: "add", path: "/messages/0", value: question });
    expect((await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input)).status).toBe("accepted");
    expect(conversation.getMessages()[0]).toEqual(question);
  } finally {
    await handle.close();
  }
});

test("a question opened while claiming delivery prevents provider input and restores the pending request", async () => {
  let calls = 0;
  const { handle, session, entry, input, owner } = await setup(async () => {
    calls++;
    return { status: "accepted" };
  });
  let question: Promise<unknown> | undefined;
  const claim = handle.deps.sessionQueueEntriesService.claimSteering;
  handle.deps.sessionQueueEntriesService.claimSteering = async (...args) => {
    const claimed = await claim(...args);
    question = owner.questionService
      .ask({ id: "late", toolUseId: "late", questions: [{ question: "Continue?" }] })
      .catch(() => {});
    return claimed;
  };
  try {
    expect(await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input)).toMatchObject({
      status: "rejected",
      reason: "blocking_input",
    });
    expect(calls).toBe(0);
    expect(await handle.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toHaveLength(1);
    expect(owner.controlInvocations.size).toBe(0);
  } finally {
    owner.questionService.dispose();
    await question;
    await handle.close();
  }
});

test("recovery publishes matching queue messages and requests after correlated delivery", async () => {
  const { handle, session, entry, input } = await setup(async () => ({
    status: "uncertain",
    reason: "Lost acknowledgement",
  }));
  try {
    const result = await steerQueuedFollowUp(handle.deps, session.id, entry.queue_position, input);
    if (result.status !== "uncertain") throw new Error("Expected held delivery");
    handle.deps.sessionService.store.remove(session.id);
    await persistSessionMessages(
      session.id,
      [{ id: result.deliveryId, role: "user", parts: [{ type: "text", text: entry.prompt }] }],
      handle.deps,
    );
    const response = await handle.app.request(`/v1/sessions/${session.id}/queued-messages`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ messages: [], queue: { requests: [] } });
  } finally {
    await handle.close();
  }
});
