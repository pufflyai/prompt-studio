import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { StorageRevisionChangedError } from "pstdio-sync";
import * as Y from "yjs";
import { resolveNativeTextAccess } from "../native-documents/source-access";
import { createTextEditingService } from "./service";
import { editorView, selected, textEditingFixture } from "./text-editing.test-fixture";

test("admitting a draft acknowledges canonical text while its physical projection is held", async () => {
  const writing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const opening = Promise.withResolvers<void>();
  let holdSave = false;
  let saving = false;
  let observeOpen = false;
  const f = await textEditingFixture({
    beforeProjection: async () => {
      if (!holdSave) return;
      holdSave = false;
      saving = true;
      writing.resolve();
      await release.promise;
    },
    afterProjection: () => {
      saving = false;
    },
    beforeDocumentLoad: async () => {
      // A complete-source reader must not straddle the owner's in-flight physical save.
      if (saving) throw new StorageRevisionChangedError();
    },
  });
  const text = createTextEditingService({
    documents: {
      ...f.documents,
      open: (input) => {
        if (observeOpen) opening.resolve();
        return f.documents.open(input);
      },
    },
    access: (input) => resolveNativeTextAccess(f.deps, input),
    catalog: f.deps.extensionRuntimeCatalog,
  });
  const document = new Y.Doc({ gc: false });
  try {
    const address = {
      projectId: "project-1",
      token: (await text.connect("project-1", { kind: "placement", viewId: editorView, target: selected })).token,
    };
    const grant = (await text.request(address, { operation: "current" }))!;
    const parent = crypto.randomUUID();
    await text.request(address, { operation: "register", memberId: parent });
    const initial = await text.request(address, { operation: "open", memberId: parent, input: { grant } });
    Y.applyUpdate(document, Buffer.from(initial.snapshot.state, "base64"));
    const vector = Y.encodeStateVector(document);
    document.getText("content").insert(0, "saved ");
    holdSave = true;
    await text.request(address, {
      operation: "submit",
      handle: initial.handle,
      sequence: 1,
      update: Buffer.from(Y.encodeStateAsUpdate(document, vector)).toString("base64"),
    });
    await writing.promise;
    const child = crypto.randomUUID();
    await text.request(address, { operation: "register", memberId: child });
    observeOpen = true;
    const sourceState = Buffer.from(Y.encodeStateAsUpdate(document)).toString("base64");
    const draftVector = Y.encodeStateVector(document);
    document.getText("content").insert(document.getText("content").length, " + draft");
    const joined = text.request(address, {
      operation: "open",
      memberId: child,
      input: { grant },
      sourceState,
      pendingUpdate: Buffer.from(Y.encodeStateAsUpdate(document, draftVector)).toString("base64"),
    });
    void joined.catch(() => {});
    await opening.promise;
    const result = await joined;
    Y.applyUpdate(document, Buffer.from(result.snapshot.state, "base64"));
    expect(document.getText("content").toString()).toBe("saved selected folder + draft");
    expect(await readFile(join(f.root, "notes.txt"), "utf8")).toBe("selected folder");
    release.resolve();
    await text.request(address, { operation: "project", handle: result.handle, revision: result.snapshot.revision });
    expect(await readFile(join(f.root, "notes.txt"), "utf8")).toBe("saved selected folder + draft");
    await text.request(address, { operation: "close", handle: result.handle });
    await text.request(address, { operation: "close", handle: initial.handle });
  } finally {
    release.resolve();
    document.destroy();
    await text.dispose();
    await f.cleanup();
  }
});

test("a projection registration cannot seed a missing canonical authority from physical content", async () => {
  const f = await textEditingFixture();
  try {
    const address = {
      projectId: "project-1",
      token: (await f.text.connect("project-1", { kind: "agent", target: selected })).token,
    };
    const grant = (await f.text.request(address, { operation: "current" }))!;
    const source = await resolveNativeTextAccess(f.deps, { ...selected, projectId: address.projectId });
    await f.deps.extensionStorageService.nativeFileProjections.initialize({ ...source, state: null });
    const memberId = crypto.randomUUID();
    await f.text.request(address, { operation: "register", memberId });
    await expect(f.text.request(address, { operation: "open", memberId, input: { grant } })).rejects.toMatchObject({
      code: "source_unavailable",
    });
    expect(f.documents.sources.current(source.owner)).toEqual([]);
    await expect(
      f.deps.extensionStorageService
        .openNativeTextDocument({ owner: source.owner, fileId: source.documentKey })
        .snapshot(),
    ).rejects.toMatchObject({ code: "native_source_pending" });
  } finally {
    await f.cleanup();
  }
});
