import { expect, test } from "bun:test";
import type { TextEditingRequest, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import { applyTextEditorUpdate, readTextDocumentSeed, seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import type { GuestHost } from "./guest-host";
import { createTextEditingClient } from "./text-editing-client";
import { decodeTextBytes, encodeTextBytes } from "./text-editing-codec";

const fixture = async (editable = true) => {
  const document = new Y.Doc();
  await seedTextDocument(document, "source");
  const listeners = new Set<(value: unknown) => void>();
  let revision = 1;
  let hold: (() => Promise<void>) | undefined;
  const snapshot = async (): Promise<TextWireSnapshot> => ({
    state: encodeTextBytes(Y.encodeStateAsUpdate(document)),
    seedId: (await readTextDocumentSeed(document)).id,
    sourceSeedId: (await readTextDocumentSeed(document)).id,
    revision,
    editable,
  });
  const frames: string[] = [];
  const sequences: number[] = [];
  const projects: number[] = [];
  let loseAck = false;
  let retireDraft = false;
  let memberId = "";
  const open = async (input: Extract<TextEditingRequest, { operation: "open" }>) => {
    memberId = input.memberId;
    if (input.sourceState && !editable)
      throw Object.assign(new Error("Readonly recovery"), { code: "source_read_only", retryable: false });
    if (input.pendingUpdate && retireDraft)
      throw Object.assign(new Error("Source retired"), { code: "source_retired", retryable: false });
    if (input.pendingUpdate) {
      applyTextEditorUpdate(document, decodeTextBytes(input.pendingUpdate));
      revision++;
    }
    if (input.pendingUpdate) await hold?.();
    return { handle: input.memberId, grant: { token: "fixture" }, snapshot: await snapshot() };
  };
  const host = {
    call: async (_name: string, input: TextEditingRequest) => {
      if (input.operation === "open") return open(input);
      if (input.operation === "submit") {
        frames.push(input.update);
        sequences.push(input.sequence);
        applyTextEditorUpdate(document, decodeTextBytes(input.update));
        revision++;
        const reply = await snapshot();
        await hold?.();
        if (loseAck) {
          loseAck = false;
          throw new Error("Connection closed before acknowledgement");
        }
        return reply;
      }
      if (input.operation === "snapshot") return snapshot();
      if (input.operation === "project") {
        projects.push(input.revision);
        return { revision: input.revision };
      }
    },
    onEvent: (_scope: string, handler: (value: unknown) => void) => {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  } as GuestHost;
  return {
    document,
    frames,
    sequences,
    projects,
    retireDraft: () => {
      retireDraft = true;
    },
    readonly: () => {
      editable = false;
    },
    loseAck: () => {
      loseAck = true;
    },
    emit: (event: object) => {
      for (const listener of listeners) listener({ ...event, memberId, handle: memberId });
    },
    host,
    hold: (next?: () => Promise<void>) => {
      hold = next;
    },
    session: await createTextEditingClient(host).open({ sourceId: "body", params: {} }),
  };
};

test("close drains a second SDK edit queued behind a held durable acknowledgement", async () => {
  const f = await fixture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  f.hold(async () => {
    entered.resolve();
    await release.promise;
  });
  f.session.transact((text) => text.insert(0, "first "));
  await entered.promise;
  f.session.transact((text) => text.insert(text.length, " second"));
  const closing = f.session.close();
  release.resolve();
  await closing;
  expect(f.document.getText("content").toString()).toBe("first source second");
  expect(f.frames).toHaveLength(2);
  f.document.destroy();
});

test("a tentative draft blocks close and its original authored delta survives peer edits", async () => {
  const f = await fixture();
  const draft = f.session.createDraft();
  draft.text.insert(draft.text.length, " draft");
  await expect(f.session.close()).rejects.toMatchObject({ code: "draft_active" });
  f.session.transact((text) => text.insert(0, "peer "));
  await f.session.flush();
  await draft.commit();
  await draft.commit();
  expect(f.document.getText("content").toString()).toBe("peer source draft");
  await f.session.close();
  f.document.destroy();
});

test("flush waits for its captured authored prefix while a later edit remains unacknowledged", async () => {
  const f = await fixture();
  const firstEntered = Promise.withResolvers<void>();
  const secondEntered = Promise.withResolvers<void>();
  const firstRelease = Promise.withResolvers<void>();
  const secondRelease = Promise.withResolvers<void>();
  let calls = 0;
  f.hold(async () => {
    if (++calls === 1) {
      firstEntered.resolve();
      await firstRelease.promise;
    } else {
      secondEntered.resolve();
      await secondRelease.promise;
    }
  });
  f.session.transact((text) => text.insert(0, "first "));
  let flushed = false;
  const prefix = f.session.flush().then(() => {
    flushed = true;
  });
  await firstEntered.promise;
  f.session.transact((text) => text.insert(text.length, " later"));
  firstRelease.resolve();
  await secondEntered.promise;
  await Promise.resolve();
  try {
    expect(flushed).toBe(true);
    expect(f.session.getSnapshot().pending).toBe(true);
  } finally {
    secondRelease.resolve();
    await prefix;
    await f.session.close();
    f.document.destroy();
  }
});

test("lost durable acknowledgements retry the same member sequence and authored bytes", async () => {
  const f = await fixture();
  f.loseAck();
  f.session.transact((text) => text.insert(0, "once "));
  await expect(f.session.flush()).rejects.toThrow("Connection closed");
  expect(f.session.getSnapshot().pending).toBe(true);
  await f.session.retry();
  expect(f.sequences).toEqual([1, 1]);
  expect(f.frames[0]).toBe(f.frames[1]);
  expect(f.document.getText("content").toString()).toBe("once source");
  await f.session.close();
  f.document.destroy();
});

test("read-only sessions reject direct binding transactions before changing their source text", async () => {
  const f = await fixture(false);
  const snapshot = f.session.getSnapshot();
  expect(() => f.session.transact((text) => text.insert(0, "forbidden "))).toThrow();
  expect(snapshot.text.toString()).toBe("source");
  expect(f.frames).toHaveLength(0);
  await f.session.close();
  f.document.destroy();
});

test("a projection fence keeps its captured durable revision while a later edit awaits acknowledgement", async () => {
  const f = await fixture();
  const firstEntered = Promise.withResolvers<void>();
  const secondEntered = Promise.withResolvers<void>();
  const firstRelease = Promise.withResolvers<void>();
  const secondRelease = Promise.withResolvers<void>();
  let calls = 0;
  f.hold(async () => {
    if (++calls === 1) {
      firstEntered.resolve();
      await firstRelease.promise;
    } else {
      secondEntered.resolve();
      await secondRelease.promise;
    }
  });
  f.session.transact((text) => text.insert(0, "first "));
  const projection = f.session.project();
  await firstEntered.promise;
  f.session.transact((text) => text.insert(text.length, " later"));
  firstRelease.resolve();
  await secondEntered.promise;
  try {
    await projection;
    expect(f.projects).toEqual([2]);
    expect(f.session.getSnapshot().pending).toBe(true);
  } finally {
    secondRelease.resolve();
    await f.session.close();
    f.document.destroy();
  }
});

test("unsupported direct read-only mutations remain recoverable without poisoning Yjs transactions", async () => {
  const f = await fixture(false);
  const text = f.session.getSnapshot().text;
  text.insert(0, "first ");
  text.insert(0, "second ");
  expect(text.toString()).toBe("second first source");
  expect(f.session.getSnapshot().pending).toBe(true);
  expect(f.session.getSnapshot().error?.code).toBe("source_read_only");
  await expect(f.session.flush()).rejects.toMatchObject({ code: "source_read_only" });
  expect(f.frames).toHaveLength(0);
  f.document.destroy();
});

test("a frozen draft admits only its captured delta even if a retained Yjs copy is mutated again", async () => {
  const f = await fixture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  f.hold(async () => {
    entered.resolve();
    await release.promise;
  });
  const draft = f.session.createDraft();
  draft.text.insert(0, "frozen ");
  const committing = draft.commit();
  await entered.promise;
  draft.text.insert(0, "ignored ");
  draft.text.insert(0, "also ignored ");
  release.resolve();
  await committing;
  await draft.commit();
  expect(f.document.getText("content").toString()).toBe("frozen source");
  await f.session.close();
  f.document.destroy();
});

test("a retired frozen draft fails its flush fence and retains recovery until explicit cancellation", async () => {
  const f = await fixture();
  f.retireDraft();
  const draft = f.session.createDraft();
  draft.text.insert(0, "recover ");
  await expect(draft.commit()).rejects.toMatchObject({ code: "source_retired" });
  expect(f.session.getSnapshot().error?.code).toBe("source_retired");
  await expect(f.session.flush()).rejects.toMatchObject({ code: "source_retired" });
  expect(draft.text.toString()).toBe("recover source");
  draft.cancel();
  expect(f.session.getSnapshot().pending).toBe(false);
  await f.session.close();
  f.document.destroy();
});

test("a lost acknowledgement retries its admitted batch before requesting writable recovery history", async () => {
  const f = await fixture();
  f.loseAck();
  f.session.transact((text) => text.insert(0, "saved "));
  await expect(f.session.flush()).rejects.toThrow("Connection closed");
  f.readonly();
  await f.session.retry();
  expect(f.sequences).toEqual([1, 1]);
  expect(f.session.getSnapshot().pending).toBe(false);
  expect(f.session.getSnapshot().editable).toBe(false);
  await f.session.close();
  f.document.destroy();
});
