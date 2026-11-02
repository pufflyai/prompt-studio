import { afterEach, expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTextEditingClient, type GuestHost } from "@pstdio/sdk/extensions";
import type { TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import { editorView, selected, textEditingFixture } from "./text-editing.test-fixture";

const fixtures: Awaited<ReturnType<typeof textEditingFixture>>[] = [];
afterEach(async () => {
  for (const f of fixtures.splice(0)) await f.cleanup();
});
const setup = async () => {
  const f = await textEditingFixture();
  fixtures.push(f);
  const address = {
    projectId: "project-1",
    token: (await f.text.connect("project-1", { kind: "placement", viewId: editorView, target: selected })).token,
  };
  let hold: ((input: TextEditingRequest) => Promise<void>) | undefined;
  let before: typeof hold;
  const host = {
    call: async (_name: string, input: TextEditingRequest) => {
      await before?.(input);
      const result = await f.text.request(address, input);
      await hold?.(input);
      return result;
    },
    onEvent: (_scope: string, listener: (payload: unknown) => void) => f.text.listen(address, listener),
  } as GuestHost;
  const client = createTextEditingClient(host);
  return {
    ...f,
    address,
    client,
    before: (handler?: (input: TextEditingRequest) => Promise<void>) => {
      before = handler;
    },
    hold: (handler?: (input: TextEditingRequest) => Promise<void>) => {
      hold = handler;
    },
    open: async () => client.open({ grant: (await client.current())! }),
  };
};

test("one failed close finalizer restores every member of the same placement", async () => {
  const f = await setup();
  const first = await f.open();
  const second = await f.open();
  const draft = second.createDraft();
  draft.text.insert(0, "unfinished ");
  await expect(f.text.prepareClose(f.address)).rejects.toMatchObject({ code: "draft_active" });
  expect(first.getSnapshot().closing).toBe(false);
  expect(second.getSnapshot().closing).toBe(false);
  first.transact((text) => text.insert(0, "kept "));
  await first.flush();
  draft.cancel();
  await f.text.prepareClose(f.address);
  expect(first.getSnapshot().closing).toBe(true);
  expect(second.getSnapshot().closing).toBe(true);
  await first.close();
  await second.close();
});

test("placement close waits for SDK-only text queued behind a held durable acknowledgement", async () => {
  const f = await setup();
  const session = await f.open();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  f.hold(async (input) => {
    if (input.operation === "submit" && ++calls === 1) {
      entered.resolve();
      await release.promise;
    }
  });
  session.transact((text) => text.insert(0, "first "));
  await entered.promise;
  session.transact((text) => text.insert(text.length, " second"));
  let closed = false;
  const closing = f.text.prepareClose(f.address).then(() => {
    closed = true;
  });
  await Promise.resolve();
  expect(closed).toBe(false);
  release.resolve();
  await closing;
  expect(session.getSnapshot().text.toString()).toBe("first selected folder second");
  expect(session.getSnapshot().pending).toBe(false);
  await session.close();
});

test("a member registered before open completes participates in the host close barrier", async () => {
  const f = await setup();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  f.hold(async (input) => {
    if (input.operation === "open") {
      entered.resolve();
      await release.promise;
    }
  });
  const opening = f.open();
  await entered.promise;
  let closed = false;
  const closing = f.text.prepareClose(f.address).then(() => {
    closed = true;
  });
  await Promise.resolve();
  expect(closed).toBe(false);
  release.resolve();
  const session = await opening;
  await closing;
  expect(session.getSnapshot().closing).toBe(true);
  await session.close();
});

test("a draft refused as read only can be explicitly cancelled before ordinary close", async () => {
  const f = await setup();
  const session = await f.open();
  const draft = session.createDraft();
  draft.text.insert(0, "not admitted ");
  await writeFile(join(f.root, "read-only"), "");
  await expect(draft.commit()).rejects.toMatchObject({ code: "source_read_only" });
  expect(session.getSnapshot().text.toString()).toBe("selected folder");
  draft.cancel();
  expect(session.getSnapshot().pending).toBe(false);
  await session.close();
});

test("an admitted draft with a lost acknowledgement cannot be cancelled and replays exactly once", async () => {
  const f = await setup();
  const session = await f.open();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let opens = 0;
  f.hold(async (input) => {
    if (input.operation === "open" && input.pendingUpdate && ++opens === 1) {
      entered.resolve();
      await release.promise;
      throw new Error("Connection lost before draft acknowledgement");
    }
  });
  const draft = session.createDraft();
  draft.text.insert(0, "once ");
  const committing = draft.commit();
  await entered.promise;
  draft.cancel();
  expect(session.getSnapshot().pending).toBe(true);
  release.resolve();
  await expect(committing).rejects.toThrow("Connection lost");
  draft.cancel();
  expect(session.getSnapshot().pending).toBe(true);
  await writeFile(join(f.root, "read-only"), "");
  await draft.commit();
  expect(opens).toBe(2);
  expect(session.getSnapshot().text.toString()).toBe("once selected folder");
  expect(session.getSnapshot().pending).toBe(false);
  expect(session.getSnapshot().editable).toBe(false);
  draft.cancel();
  expect(session.getSnapshot().text.toString()).toBe("once selected folder");
  await session.close();
});

test("a later read-only refusal cannot make an uncertain draft admission cancellable", async () => {
  const f = await setup();
  const session = await f.open();
  const draft = session.createDraft();
  draft.text.insert(0, "recover ");
  f.before(async (input) => {
    if (input.operation === "open" && input.pendingUpdate)
      throw new Error("Transport ended without an admission result");
  });
  await expect(draft.commit()).rejects.toThrow("Transport ended");
  f.before();
  await writeFile(join(f.root, "read-only"), "");
  await expect(draft.commit()).rejects.toMatchObject({ code: "source_read_only" });
  draft.cancel();
  expect(session.getSnapshot().pending).toBe(true);
  expect(draft.text.toString()).toBe("recover selected folder");
  await expect(session.close()).rejects.toMatchObject({ code: "source_read_only" });
  await rm(join(f.root, "read-only"));
  await draft.commit();
  expect(session.getSnapshot().text.toString()).toBe("recover selected folder");
  await session.close();
});

test("an acknowledged draft stays settled when its member cleanup acknowledgement is lost", async () => {
  const f = await setup();
  const session = await f.open();
  let draftOpens = 0;
  let cleanupLost = false;
  f.hold(async (input) => {
    if (input.operation === "open" && input.pendingUpdate) draftOpens++;
    if (input.operation === "close" && !cleanupLost) {
      cleanupLost = true;
      await writeFile(join(f.root, "read-only"), "");
      throw new Error("Draft cleanup acknowledgement lost");
    }
  });
  const draft = session.createDraft();
  draft.text.insert(0, "durable ");
  await expect(draft.commit()).rejects.toThrow("cleanup acknowledgement lost");
  expect(session.getSnapshot().pending).toBe(false);
  draft.cancel();
  await session.close();
  expect(draftOpens).toBe(1);
  expect(session.getSnapshot().text.toString()).toBe("durable selected folder");
});

test("ordinary close releases an acknowledged draft whose cleanup request never reached the host", async () => {
  const f = await setup();
  const session = await f.open();
  let interrupted = false;
  f.before(async (input) => {
    if (input.operation === "close" && !interrupted) {
      interrupted = true;
      throw new Error("Draft cleanup request interrupted");
    }
  });
  const draft = session.createDraft();
  draft.text.insert(0, "saved ");
  await expect(draft.commit()).rejects.toThrow("cleanup request interrupted");
  await draft.commit();
  await session.close();
  expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
});

test("a member opened during a held close finalizer joins the active preparation", async () => {
  const f = await setup();
  const first = await f.open();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  first.beforeClose(async () => {
    entered.resolve();
    await release.promise;
  });
  const preparing = f.text.prepareClose(f.address);
  let second: Awaited<ReturnType<typeof f.open>> | undefined;
  try {
    await entered.promise;
    second = await f.open();
    expect(second.getSnapshot().closing).toBe(true);
  } finally {
    release.resolve();
    await second?.close();
    await preparing;
    await first.close();
  }
});

test("a late member does not repeat finalizers for members already ready for the same close barrier", async () => {
  const f = await setup();
  const first = await f.open();
  const held = await f.open();
  let finalized = 0;
  const entered = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  first.beforeClose(() => {
    finalized++;
  });
  held.beforeClose(async () => {
    entered.resolve();
    await release.promise;
  });
  f.hold(async (input) => {
    if (input.operation === "closeReady") ready.resolve();
  });
  const preparing = f.text.prepareClose(f.address);
  let late: Awaited<ReturnType<typeof f.open>> | undefined;
  try {
    await Promise.all([entered.promise, ready.promise]);
    late = await f.open();
    expect(late.getSnapshot().closing).toBe(true);
    expect(finalized).toBe(1);
  } finally {
    release.resolve();
    f.hold();
    await late?.close();
    await preparing;
    await first.close();
    await held.close();
  }
});
