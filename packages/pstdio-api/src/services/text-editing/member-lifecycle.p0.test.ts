import { afterEach, expect, test } from "bun:test";
import * as Y from "yjs";
import { loadNativeMarkdownFile } from "../native-documents/file-source";
import { resolveNativeTextAccess } from "../native-documents/source-access";
import { createTextEditingService } from "./service";
import { editorView, selected, textEditingFixture } from "./text-editing.test-fixture";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
const setup = async () => {
  const f = await textEditingFixture();
  let hold: (() => Promise<void>) | undefined;
  const text = createTextEditingService({
    documents: f.documents,
    load: (input) => loadNativeMarkdownFile(f.deps, input),
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
