import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { initializeConversation } from "./initialize-conversation";
import { checkpointConversation } from "./session-checkpoint";
import { getSessionHistory } from "./session-history";

const turn = (id: string): SessionMessage => ({ id, role: "user", parts: [{ type: "text", text: id }] });

test("resume drains an older checkpoint before saving the replacement conversation", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Checkpoint handoff" });
    const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Resume", agent: "test" });
    const oldEntry = handle.deps.sessionService.store.create(session.id, () => {});
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
    expect((await getSessionHistory(session.id, deps)).messages).toEqual([turn("first"), turn("second")]);
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
    const oldEntry = handle.deps.sessionService.store.create(session.id, () => {});
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
    await expect(failed.conversationReady).rejects.toThrow("Checkpoint unavailable");
    expect(prepared).toBe(0);
    expect(handle.deps.sessionService.store.get(session.id)).toBe(oldEntry);
    expect((await getSessionHistory(session.id, deps)).messages).toEqual([turn("retained")]);
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
