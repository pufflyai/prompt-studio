import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { expectRejection } from "../../test-utils/expect-rejection";
import { initializeConversation } from "./initialize-conversation";
import { checkpointConversation } from "./session-checkpoint";
import { getSessionHistory } from "./session-history";
import { inertSessionChannelHooks } from "./session-store.test-utils";

const turn = (id: string): SessionMessage => ({ id, role: "user", parts: [{ type: "text", text: id }] });

test("resume drains an older checkpoint before saving the replacement conversation", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Checkpoint handoff" });
    const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Resume", agent: "test" });
    const oldEntry = handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
    const old = await oldEntry.conversationReady;
    old.push({ op: "replace", path: "/messages", value: [turn("first")] });
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let prepared = false;
    let uploads = 0;
    const deps = {
      ...handle.deps,
      fileService: {
        ...handle.deps.fileService,
        upload: async (...args: Parameters<typeof handle.deps.fileService.upload>) => {
          uploads++;
          entered.resolve();
          await release.promise;
          return handle.deps.fileService.upload(...args);
        },
      },
    };
    const oldSave = checkpointConversation(session.id, oldEntry, deps);
    await entered.promise;
    const nextEntry = initializeConversation(session.id, deps, async () => {
      prepared = true;
    });
    expect(handle.deps.sessionService.store.get(session.id)).toBe(nextEntry);
    expect(prepared).toBe(false);
    expect(old.getMessages()).toEqual([turn("first")]);
    release.resolve();
    await oldSave;
    const next = await nextEntry.conversationReady;
    expect(prepared).toBe(true);
    expect(next.getMessages()).toEqual([turn("first")]);
    next.push({ op: "add", path: "/messages/1", value: turn("second") });
    await checkpointConversation(session.id, nextEntry, deps);
    handle.deps.sessionService.store.remove(session.id, nextEntry);
    expect(await getSessionHistory(session.id, deps)).toEqual([turn("first"), turn("second")]);
    expect(uploads).toBe(1);
  } finally {
    await handle.close();
  }
});

test("a failed handoff restores readable closed history and retries its checkpoint on resume", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Checkpoint retry" });
    const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Retry", agent: "test" });
    const oldEntry = handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
    const old = await oldEntry.conversationReady;
    old.push({ op: "replace", path: "/messages", value: [turn("retained")] });
    let fail = true;
    let prepared = 0;
    const deps = {
      ...handle.deps,
      fileService: {
        ...handle.deps.fileService,
        upload: async (...args: Parameters<typeof handle.deps.fileService.upload>) => {
          if (fail) throw new Error("Checkpoint unavailable");
          return handle.deps.fileService.upload(...args);
        },
      },
    };
    const failed = initializeConversation(session.id, deps, async () => {
      prepared++;
    });
    await expectRejection(failed.conversationReady).toThrow("Checkpoint unavailable");
    expect(prepared).toBe(0);
    expect(handle.deps.sessionService.store.get(session.id)).toBe(oldEntry);
    expect(await getSessionHistory(session.id, deps)).toEqual([turn("retained")]);
    const subscription = old.snapshotAndSubscribe().stream[Symbol.asyncIterator]();
    expect((await subscription.next()).done).toBe(true);
    fail = false;
    const retry = initializeConversation(session.id, deps, async () => {
      prepared++;
    });
    expect((await retry.conversationReady).getMessages()).toEqual([turn("retained")]);
    expect(prepared).toBe(1);
    expect((await handle.deps.sessionService.get(session.id))?.session_file_id).toBeTruthy();
  } finally {
    await handle.close();
  }
});

test("an idle background reply is durable before its position and leaves the conversation open", async () => {
  const handle = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const project = await handle.deps.projectService.create({ name: "Idle durability" });
    const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Idle", agent: "test" });
    const deps = {
      ...handle.deps,
      fileService: {
        ...handle.deps.fileService,
        upload: async (...args: Parameters<typeof handle.deps.fileService.upload>) => {
          entered.resolve();
          await release.promise;
          return handle.deps.fileService.upload(...args);
        },
      },
    };
    const entry = initializeConversation(session.id, deps, async () => {});
    const conversation = await entry.conversationReady;
    const reply: SessionMessage = {
      id: "reply",
      role: "assistant",
      parts: [{ type: "text", text: "Complete background answer" }],
    };
    conversation.push({ op: "replace", path: "/messages", value: [reply] });
    entry.turns.idle({ backgroundTasks: [] });
    entry.turns.idle({ backgroundTasks: [] });
    const question = entry.questionService.ask({
      id: "question",
      toolUseId: "question",
      questions: [{ question: "Choose?" }],
    });
    void question.catch(() => undefined);
    const started = await Promise.race([entered.promise.then(() => true), Bun.sleep(1000).then(() => false)]);
    expect(started).toBe(true);
    expect((await deps.sessionService.get(session.id))?.change_positions).toBeNull();
    release.resolve();
    await entry.contentPublications;
    const saved = await deps.sessionService.get(session.id);
    expect(saved?.change_positions?.input).toMatchObject({ id: "question", position: 2 });
    expect(saved?.change_positions?.reply).toMatchObject({ id: "reply", position: 1 });
    const file = await deps.fileService.get(saved!.session_file_id!);
    expect(await Bun.file(file!.storage_path).json()).toEqual([reply]);
    expect(conversation.closed).toBe(false);
    const finalReply = { ...reply, id: "newer", parts: [{ type: "text" as const, text: "Final reply after idle" }] };
    conversation.push({ op: "add", path: "/messages/1", value: finalReply });
    await checkpointConversation(session.id, entry, deps, true);
    expect((await deps.sessionService.get(session.id))?.change_positions?.reply).toMatchObject({
      id: "newer",
      position: 3,
    });
    expect(await Bun.file(file!.storage_path).json()).toEqual([reply, finalReply]);
  } finally {
    release.resolve();
    await handle.close();
  }
});

test("a failed optional position write recovers and cannot block a later question", async () => {
  const handle = await createTestApp();
  let failUpload = true;
  let failInput = true;
  try {
    const project = await handle.deps.projectService.create({ name: "Recover positions" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Recover",
      agent: "test",
    });
    const deps = {
      ...handle.deps,
      fileService: {
        ...handle.deps.fileService,
        upload: async (...args: Parameters<typeof handle.deps.fileService.upload>) => {
          if (failUpload) {
            failUpload = false;
            throw new Error("First checkpoint unavailable");
          }
          return handle.deps.fileService.upload(...args);
        },
      },
      sessionService: {
        ...handle.deps.sessionService,
        update: async (...args: Parameters<typeof handle.deps.sessionService.update>) => {
          if (failInput && args[1].contentEvent?.kind === "input") {
            failInput = false;
            throw new Error("Input ledger unavailable");
          }
          return handle.deps.sessionService.update(...args);
        },
      },
    };
    const entry = initializeConversation(session.id, deps, async () => {});
    const conversation = await entry.conversationReady;
    const reply = (id: string): SessionMessage => ({ id, role: "assistant", parts: [{ type: "text", text: id }] });
    conversation.push({ op: "replace", path: "/messages", value: [reply("first")] });
    entry.turns.idle({ backgroundTasks: [] });
    await entry.contentPublications.catch(() => undefined);
    conversation.push({ op: "add", path: "/messages/1", value: reply("later") });
    entry.turns.idle({ backgroundTasks: [] });
    await entry.contentPublications.catch(() => undefined);
    expect((await deps.sessionService.get(session.id))?.change_positions?.reply).toMatchObject({
      id: "later",
      position: 1,
    });
    const question = entry.questionService.ask({
      id: "question",
      toolUseId: "question",
      questions: [{ question: "Choose?" }],
    });
    void question.catch(() => undefined);
    await Bun.sleep(0);
    await entry.contentPublications.catch(() => undefined);
    await Bun.sleep(0);
    expect((await deps.sessionService.get(session.id))?.status).toBe("awaiting_input");
  } finally {
    await handle.close();
  }
});

test("final checkpoint drains a question admitted while an older idle save was held", async () => {
  const handle = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const inputEntered = Promise.withResolvers<void>();
  const releaseInput = Promise.withResolvers<void>();
  let closing: Promise<unknown> | undefined;
  try {
    const project = await handle.deps.projectService.create({ name: "Late input" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Late input",
      agent: "test",
    });
    const deps = {
      ...handle.deps,
      fileService: {
        ...handle.deps.fileService,
        upload: async (...args: Parameters<typeof handle.deps.fileService.upload>) => {
          entered.resolve();
          await release.promise;
          return handle.deps.fileService.upload(...args);
        },
      },
      sessionService: {
        ...handle.deps.sessionService,
        update: async (...args: Parameters<typeof handle.deps.sessionService.update>) => {
          if (args[1].contentEvent?.kind === "input") {
            inputEntered.resolve();
            await releaseInput.promise;
          }
          return handle.deps.sessionService.update(...args);
        },
      },
    };
    const owner = initializeConversation(session.id, deps, async () => {});
    const conversation = await owner.conversationReady;
    const reply = (id: string): SessionMessage => ({ id, role: "assistant", parts: [{ type: "text", text: id }] });
    conversation.push({ op: "replace", path: "/messages", value: [reply("idle")] });
    owner.turns.idle({ backgroundTasks: [] });
    await entered.promise;
    conversation.push({ op: "add", path: "/messages/1", value: reply("final") });
    closing = checkpointConversation(session.id, owner, deps, true);
    await Bun.sleep(0);
    const question = owner.questionService.ask({ id: "late", toolUseId: "late", questions: [{ question: "Choose?" }] });
    void question.catch(() => undefined);
    await Bun.sleep(0);
    release.resolve();
    await inputEntered.promise;
    const closedEarly = await Promise.race([closing.then(() => true), Bun.sleep(30).then(() => false)]);
    expect(closedEarly).toBe(false);
    releaseInput.resolve();
    await closing;
    const saved = await deps.sessionService.get(session.id);
    expect(saved?.change_positions?.input).toMatchObject({ id: "late", position: 2 });
    expect(saved?.change_positions?.reply).toMatchObject({ id: "final", position: 3 });
  } finally {
    release.resolve();
    releaseInput.resolve();
    await closing?.catch(() => undefined);
    await handle.close();
  }
});
