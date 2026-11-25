import { afterEach, expect, test } from "bun:test";
import * as Y from "yjs";
import { resolveNativeTextAccess } from "../native-documents/source-access";
import { createProjectWork } from "../project-work";
import { createTextEditingService } from "./service";
import { editorView, selected, textEditingFixture } from "./text-editing.test-fixture";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
const setup = async (projectWork?: ReturnType<typeof createProjectWork>) => {
  const f = await textEditingFixture({ projectWork });
  let hold: (() => Promise<void>) | undefined;
  const openRoom = f.documents.open;
  f.documents.open = async (input) => {
    const room = await openRoom(input);
    await hold?.();
    return room;
  };
  const text = createTextEditingService({
    documents: f.documents,
    access: async (input) => {
      const result = await resolveNativeTextAccess(f.deps, input);
      await hold?.();
      return result;
    },
    catalog: f.deps.extensionRuntimeCatalog,
  });
  cleanups.push(async () => {
    await text.dispose();
    await f.cleanup();
  });
  const address = {
    projectId: "project-1",
    token: (await text.connect("project-1", { kind: "placement", viewId: editorView, target: selected })).token,
  };
  const grant = (await text.request(address, { operation: "current" }))!;
  const memberId = crypto.randomUUID();
  await text.request(address, { operation: "register", memberId });
  const open = () => text.request(address, { operation: "open", memberId, input: { grant } });
  return {
    ...f,
    text,
    address,
    grant,
    memberId,
    open,
    hold: (next?: () => Promise<void>) => {
      hold = next;
    },
  };
};

test("abandoning an opening member denies a late open and releases every room", async () => {
  const f = await setup();
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  f.hold(async () => {
    entered.resolve();
    await resume.promise;
  });
  const opening = f.open().catch((error) => error);
  await entered.promise;
  const abandoned = f.text.request(f.address, { operation: "abandon", memberId: f.memberId });
  const late = f.open().catch((error) => error);
  resume.resolve();
  try {
    expect(await opening).toMatchObject({ code: "session_closed" });
    await abandoned;
    expect(await late).toMatchObject({ code: "session_closed" });
    await f.text.disconnect(f.address);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
  } finally {
    resume.resolve();
    await Promise.allSettled([opening, abandoned, late]);
  }
});

test("re-registering while release waits gives the new membership ownership of its room and close barrier", async () => {
  const f = await setup();
  const previous = await f.open();
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let holdOnce = true;
  f.hold(async () => {
    if (holdOnce) {
      holdOnce = false;
      entered.resolve();
      await resume.promise;
    }
  });
  const reading = f.text
    .request(f.address, { operation: "open", memberId: f.memberId, input: { grant: f.grant } })
    .catch((error) => error);
  await entered.promise;
  let barrierId = "";
  const stop = f.text.listen(f.address, (event) => {
    if (event.type === "prepareClose") barrierId = event.barrierId;
  });
  let prepared = false;
  const closing = f.text.prepareClose(f.address).then(() => {
    prepared = true;
  });
  const abandoned = f.text.request(f.address, { operation: "abandon", memberId: f.memberId });
  await f.text.request(f.address, { operation: "register", memberId: f.memberId });
  const replacement = f.open();
  resume.resolve();
  try {
    await reading;
    await abandoned;
    const current = await replacement;
    expect(current.handle).not.toBe(previous.handle);
    await expect(f.text.request(f.address, { operation: "snapshot", handle: previous.handle })).rejects.toMatchObject({
      code: "session_closed",
    });
    expect(await f.text.request(f.address, { operation: "snapshot", handle: current.handle })).toHaveProperty("state");
    await expect(f.text.request(f.address, { operation: "close", handle: previous.handle })).rejects.toMatchObject({
      code: "session_closed",
    });
    await Promise.resolve();
    expect(prepared).toBe(false);
    await f.text.request(f.address, { operation: "closeReady", handle: current.handle, barrierId });
    await closing;
    stop();
    await f.text.disconnect(f.address);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
  } finally {
    resume.resolve();
    await Promise.allSettled([reading, abandoned, replacement]);
  }
});

test("abandon drains an already-admitted text frame before releasing its room", async () => {
  const f = await setup();
  const opened = await f.open();
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const submit = f.documents.submit;
  f.documents.submit = async (input) => {
    const result = await submit(input);
    entered.resolve();
    await resume.promise;
    return result;
  };
  const author = new Y.Doc();
  Y.applyUpdate(author, Buffer.from(opened.snapshot.state, "base64"));
  const vector = Y.encodeStateVector(author);
  author.getText("content").insert(0, "saved ");
  const saving = f.text.request(f.address, {
    operation: "submit",
    handle: opened.handle,
    sequence: 1,
    update: Buffer.from(Y.encodeStateAsUpdate(author, vector)).toString("base64"),
  });
  await entered.promise;
  const abandoned = f.text.request(f.address, { operation: "abandon", memberId: f.memberId });
  resume.resolve();
  try {
    expect(await saving).toHaveProperty("revision");
    await abandoned;
    await f.text.request(f.address, { operation: "register", memberId: f.memberId });
    const reopened = await f.open();
    const current = new Y.Doc();
    try {
      Y.applyUpdate(current, Buffer.from(reopened.snapshot.state, "base64"));
      expect(current.getText("content").toString()).toBe("saved selected folder");
    } finally {
      current.destroy();
    }
    await f.text.disconnect(f.address);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
  } finally {
    resume.resolve();
    author.destroy();
    await Promise.allSettled([saving, abandoned]);
  }
});

test("an opening request cannot claim a same-ID successor while presentation lookup is pending", async () => {
  const f = await setup();
  const catalog = f.deps.extensionRuntimeCatalog;
  const get = catalog.get.bind(catalog);
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let pause = true;
  catalog.get = async (projectId) => {
    const result = await get(projectId);
    if (pause) {
      pause = false;
      entered.resolve();
      await resume.promise;
    }
    return result;
  };
  const opening = f.open().catch((error) => error);
  await entered.promise;
  const abandoned = f.text.request(f.address, { operation: "abandon", memberId: f.memberId });
  await f.text.request(f.address, { operation: "register", memberId: f.memberId });
  const successor = f.text.request(f.address, {
    operation: "open",
    memberId: f.memberId,
    input: { sourceId: "body", params: {} },
  });
  resume.resolve();
  try {
    expect(await opening).toMatchObject({ code: "session_closed" });
    await abandoned;
    const current = await successor;
    const document = new Y.Doc();
    try {
      Y.applyUpdate(document, Buffer.from(current.snapshot.state, "base64"));
      expect(document.getText("content").toString()).toBe("Editor owned");
    } finally {
      document.destroy();
    }
    await f.text.disconnect(f.address);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "thirdparty.editor" })).toEqual([]);
  } finally {
    resume.resolve();
    await Promise.allSettled([opening, abandoned, successor]);
  }
});

test("a release rejected during removal can retry its handle and finish the close barrier", async () => {
  const work = createProjectWork();
  const f = await setup(work);
  const opened = await f.open();
  let prepared = false;
  const closing = f.text.prepareClose(f.address).then(() => {
    prepared = true;
  });
  work.freeze("project-1");
  try {
    await expect(f.text.request(f.address, { operation: "close", handle: opened.handle })).rejects.toBeDefined();
    expect(prepared).toBe(false);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).not.toEqual([]);
    await expect(f.documents.resolveSource({ ...selected, projectId: "project-1" })).rejects.toThrow(
      "removing its copy",
    );
    work.release("project-1");
    await f.text.request(f.address, { operation: "close", handle: opened.handle });
    expect(prepared).toBe(true);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
    await closing;
  } finally {
    work.release("project-1");
    await f.text.disconnect(f.address);
    await closing.catch(() => {});
  }
});

test("failed detached cleanup keeps the original handle distinct from a same-ID successor", async () => {
  const work = createProjectWork();
  const f = await setup(work);
  const previous = await f.open();
  const release = f.documents.release;
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let hold = true;
  f.documents.release = async (input) => {
    if (hold) {
      hold = false;
      entered.resolve();
      await resume.promise;
    }
    await release(input);
  };
  const abandoned = f.text.request(f.address, { operation: "abandon", memberId: f.memberId }).catch((error) => error);
  try {
    await entered.promise;
    await f.text.request(f.address, { operation: "register", memberId: f.memberId });
    const current = await f.open();
    work.freeze("project-1");
    resume.resolve();
    expect(await abandoned).toBeInstanceOf(Error);
    work.release("project-1");
    await f.text.request(f.address, { operation: "close", handle: previous.handle });
    expect(await f.text.request(f.address, { operation: "snapshot", handle: current.handle })).toHaveProperty("state");
    await f.text.request(f.address, { operation: "close", handle: current.handle });
    await f.text.prepareClose(f.address);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
  } finally {
    resume.resolve();
    work.release("project-1");
    await abandoned;
    f.documents.release = release;
  }
});

test("disconnect retains failed room cleanup for a later retry", async () => {
  const work = createProjectWork();
  const f = await setup(work);
  await f.open();
  work.freeze("project-1");
  try {
    await expect(f.text.disconnect(f.address)).rejects.toBeDefined();
    await expect(f.text.request(f.address, { operation: "current" })).rejects.toMatchObject({
      code: "connection_expired",
    });
    work.release("project-1");
    await f.text.disconnect(f.address);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
  } finally {
    work.release("project-1");
  }
});

test("disconnect completes member cleanup after native project withdrawal already closed its rooms", async () => {
  const f = await setup();
  await f.open();
  await f.documents.withdrawProject("project-1");
  await f.text.disconnect(f.address);
  await f.text.dispose();
  expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
});

test("a listener that replaces one whose stream has not closed yet receives each open member's current snapshot", async () => {
  const f = await setup();
  const first: string[] = [];
  const stopFirst = f.text.listen(f.address, (event) => {
    if (event.type === "snapshot") first.push(event.handle);
  });
  cleanups.unshift(async () => stopFirst());
  const { handle } = await f.open();
  const until = async (condition: () => boolean) => {
    const end = Date.now() + 1000;
    while (!condition() && Date.now() < end) await Bun.sleep(1);
    expect(condition()).toBe(true);
  };
  await until(() => first.includes(handle));
  // A dropped client reconnects before the server notices that its old stream closed.
  const replacement: string[] = [];
  const stopReplacement = f.text.listen(f.address, (event) => {
    if (event.type === "snapshot") replacement.push(event.handle);
  });
  cleanups.unshift(async () => stopReplacement());
  await until(() => replacement.includes(handle));
});
