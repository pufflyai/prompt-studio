import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { initializeConversation } from "./initialize-conversation";
import { steerQueuedFollowUp } from "./queued-steering";

test("an accepted steer remains durable when an older idle checkpoint was held", async () => {
  const handle = await createTestApp();
  const firstEntered = Promise.withResolvers<void>();
  const secondEntered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let uploads = 0;
  try {
    const project = await handle.deps.projectService.create({ name: "Ordered steering" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Steering",
      agent: "fake",
    });
    const deps = {
      ...handle.deps,
      fileService: {
        ...handle.deps.fileService,
        upload: async (...args: Parameters<typeof handle.deps.fileService.upload>) => {
          if (++uploads === 1) {
            firstEntered.resolve();
            await release.promise;
          } else secondEntered.resolve();
          return handle.deps.fileService.upload(...args);
        },
      },
    };
    const owner = initializeConversation(session.id, deps, async () => {});
    const conversation = await owner.conversationReady;
    owner.executionSettings = { model: "model", params: {} };
    const handedOff = Promise.withResolvers<void>();
    owner.session = {
      done: new Promise(() => {}),
      stop() {},
      steer: async (input) => {
        conversation.push({
          op: "add",
          path: `/messages/${conversation.getMessages().length}`,
          value: { id: input.deliveryId, role: "user", parts: [{ type: "text", text: input.prompt }] },
        });
        handedOff.resolve();
        return { status: "accepted" };
      },
    };
    const reply: SessionMessage = { id: "reply", role: "assistant", parts: [{ type: "text", text: "Finished turn" }] };
    conversation.push({ op: "replace", path: "/messages", value: [reply] });
    owner.turns.idle({ backgroundTasks: [] });
    await firstEntered.promise;
    const entry = await deps.sessionQueueEntriesService.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "Correction",
      model: "model",
      params_json: {},
    });
    const delivery = steerQueuedFollowUp(deps, session.id, entry.queue_position, {
      expectedRevision: entry.revision,
      expectedRunStartedAt: session.last_request_started!,
    });
    await handedOff.promise;
    const overlapped = await Promise.race([secondEntered.promise.then(() => true), Bun.sleep(100).then(() => false)]);
    if (overlapped) await delivery;
    release.resolve();
    await owner.contentPublications;
    expect((await delivery).status).toBe("accepted");
    const saved = await deps.sessionService.get(session.id);
    const file = await deps.fileService.get(saved!.session_file_id!);
    expect(await Bun.file(file!.storage_path).json()).toEqual(conversation.getMessages());
    expect(await deps.sessionQueueEntriesService.get(entry.queue_position)).toBeNull();
  } finally {
    release.resolve();
    await handle.close();
  }
});
