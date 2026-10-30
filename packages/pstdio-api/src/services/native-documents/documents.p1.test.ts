import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { Hono } from "hono";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { saveTextDocument, seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { createWorkspaceContextFixture } from "../../features/extensions/workspace-context.test-fixture";
import { createNativeDocumentRoutes } from "../../features/native-documents/routes";
import { createNativeDocumentService } from "./documents";
import { loadNativeMarkdownFile, saveNativeMarkdownFile } from "./file-source";
import { initializeNativeSource } from "./source-binding";

let extension: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
const services: ReturnType<typeof createNativeDocumentService>[] = [];
const createService = (
  options: Omit<Parameters<typeof createNativeDocumentService>[0], "deviceId" | "presenceIdentity" | "initialize">,
) => {
  const service = createNativeDocumentService({
    ...options,
    initialize: (loaded) =>
      initializeNativeSource({ ...extension.deps, extensionStorageService: options.storage }, loaded),
    deviceId: "fixture-device",
    presenceIdentity: async () => ({ label: "Fixture user", deviceName: "Fixture device" }),
  });
  services.push(service);
  return service;
};
let storage: Awaited<ReturnType<typeof createDb>> & {
  projectAId: string;
  projectBId: string;
  svc: ReturnType<typeof createExtensionStorageDBService>;
};
beforeEach(async () => {
  extension = await createWorkspaceContextFixture();
  const database = await createDb({ path: ":memory:" });
  const projectAId = "project-1";
  const projectBId = "project-2";
  const timestamp = new Date().toISOString();
  await database.db.insert(projects).values(
    [projectAId, projectBId].map((id) => ({
      id,
      name: id,
      shorthand: id,
      created_at: timestamp,
      updated_at: timestamp,
    })),
  );
  storage = { ...database, projectAId, projectBId, svc: createExtensionStorageDBService(database.db) };
  await Bun.write(
    join(extension.root, "extension.ts"),
    `export default { views: [{
    id: "document", ref: { kind: "view", id: "document" }, title: "Document",
    body: { kind: "file", load: async (ctx) => ({ documentSource: { kind: "workspace", path: "notes.txt" }, content: await ctx.workspaceFiles.readText("notes.txt"), fileName: "notes.md" }),
      save: async (ctx, params) => {
        if (await ctx.workspaceFiles.exists("pause-save")) throw new Error("File save paused");
        await ctx.workspaceFiles.writeText("notes.txt", params.content);
        if (await ctx.workspaceFiles.exists("pause-after-write")) throw new Error("Save failed after writing bytes");
      } },
  }] };`,
  );
});
afterEach(async () => {
  for (const service of services.splice(0)) await service.dispose();
  await storage.close();
  await extension.cleanup();
});
const setup = () => {
  const deps = { ...extension.deps, extensionStorageService: storage.svc };
  return {
    deps,
    service: createService({
      storage: deps.extensionStorageService,
      load: (input) => loadNativeMarkdownFile(deps, input),
      save: (input) => saveNativeMarkdownFile(deps, input),
    }),
  };
};
const target = { fileRendererId: "example.context.view.document", resource: undefined };
const open = (service: ReturnType<typeof createNativeDocumentService>) =>
  service.open({ ...target, projectId: storage.projectAId });

test("open editor sources can register with relay before unrelated discovery finishes", async () => {
  const { service } = setup();
  const selected: string[] = [];
  const stop = service.sources.watch((_owner, name) => selected.push(name));
  try {
    const first = await open(service);
    const second = await open(service);
    const name = JSON.stringify(["native-markdown", first.documentKey]);
    expect(selected).toEqual([name, name]);
    expect(service.sources.current(first.owner)).toEqual([name]);
    await service.close({ projectId: storage.projectAId, roomId: first.roomId });
    expect(service.sources.current(first.owner)).toEqual([name]);
    await service.close({ projectId: storage.projectAId, roomId: second.roomId });
    expect(service.sources.current(first.owner)).toEqual([]);
  } finally {
    stop();
  }
});

test("durable acknowledgements and peer snapshots do not wait for a file save", async () => {
  const deps = { ...extension.deps, extensionStorageService: storage.svc };
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const service = createService({
    storage: storage.svc,
    load: (input) => loadNativeMarkdownFile(deps, input),
    save: async (input) => {
      entered.resolve();
      await release.promise;
      return saveNativeMarkdownFile(deps, input);
    },
  });
  const room = await open(service);
  const peer = await open(service);
  const author = new Y.Doc();
  Y.applyUpdate(author, room.state);
  const vector = Y.encodeStateVector(author);
  author.getText("content").insert(0, "EDITOR ");
  const submitted = service.submit({
    projectId: storage.projectAId,
    roomId: room.roomId,
    update: Y.encodeStateAsUpdate(author, vector),
  });
  try {
    await entered.promise;
    const accepted = await Promise.race([submitted, Bun.sleep(1000).then(() => null)]);
    expect(accepted).not.toBeNull();
    const received = await service.snapshot({ projectId: storage.projectAId, roomId: peer.roomId });
    Y.applyUpdate(author, received.state);
    expect(author.getText("content").toString()).toBe("EDITOR selected folder");
    // Another edit while the save is held must be included in the final physical copy.
    const before = Y.encodeStateVector(author);
    author.getText("content").insert(author.getText("content").length, " LATER");
    await service.submit({
      projectId: storage.projectAId,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, before),
    });
  } finally {
    release.resolve();
    await submitted;
    await service.close({ projectId: storage.projectAId, roomId: room.roomId });
    author.destroy();
  }
  expect(await readFile(join(extension.root, "notes.txt"), "utf8")).toBe("EDITOR selected folder LATER");
});

test("opening during a file projection cannot import a stale load as an outside edit", async () => {
  const deps = { ...extension.deps, extensionStorageService: storage.svc };
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const loaded = Promise.withResolvers<void>();
  let hold = true;
  let reopening = false;
  const service = createService({
    storage: storage.svc,
    load: async (input) => {
      const result = await loadNativeMarkdownFile(deps, input);
      if (reopening) loaded.resolve();
      return result;
    },
    save: async (input) => {
      if (hold) {
        hold = false;
        entered.resolve();
        await release.promise;
      }
      return saveNativeMarkdownFile(deps, input);
    },
  });
  const room = await open(service);
  const author = new Y.Doc();
  Y.applyUpdate(author, room.state);
  try {
    const first = Y.encodeStateVector(author);
    author.getText("content").insert(0, "FIRST ");
    await service.submit({
      projectId: storage.projectAId,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, first),
    });
    await entered.promise;
    const second = Y.encodeStateVector(author);
    author.getText("content").insert(author.getText("content").length, " LAST");
    await service.submit({
      projectId: storage.projectAId,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, second),
    });
    reopening = true;
    const next = open(service);
    await loaded.promise;
    release.resolve();
    const joined = await next;
    const received = new Y.Doc();
    try {
      Y.applyUpdate(received, joined.state);
      expect(received.getText("content").toString()).toBe("FIRST selected folder LAST");
    } finally {
      received.destroy();
    }
    await service.close({ projectId: storage.projectAId, roomId: joined.roomId });
    expect(await readFile(join(extension.root, "notes.txt"), "utf8")).toBe("FIRST selected folder LAST");
  } finally {
    release.resolve();
    author.destroy();
  }
});

test("native edits project through the file save handler and retain a non-overlapping outside write", async () => {
  const { service } = setup();
  const room = await open(service);
  const author = new Y.Doc();
  try {
    Y.applyUpdate(author, room.state);
    const vector = Y.encodeStateVector(author);
    author.getText("content").insert(0, "EDITOR ");
    await writeFile(join(extension.root, "notes.txt"), "selected folder OUTSIDE");
    const accepted = await service.submit({
      projectId: storage.projectAId,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, vector),
    });
    expect(accepted.revision).toBeGreaterThan(0);
    await service.flush({ projectId: storage.projectAId, roomId: room.roomId });
    const result = new Y.Doc();
    const projected = await service.snapshot({ projectId: storage.projectAId, roomId: room.roomId });
    Y.applyUpdate(result, projected.state);
    expect(result.getText("content").toString()).toBe("EDITOR selected folder OUTSIDE");
    expect(await readFile(join(extension.root, "notes.txt"), "utf8")).toBe("EDITOR selected folder OUTSIDE");
    result.destroy();
    await service.close({ projectId: storage.projectAId, roomId: room.roomId });
  } finally {
    author.destroy();
  }
});

test("a racing file projection retains its pending write and acknowledges durable editor frames", async () => {
  const deps = { ...extension.deps, extensionStorageService: storage.svc };
  let outsideWrite = false;
  const service = createService({
    storage: storage.svc,
    load: (input) => loadNativeMarkdownFile(deps, input),
    save: async (input) => {
      if (!outsideWrite) {
        outsideWrite = true;
        await writeFile(join(extension.root, "notes.txt"), "selected folder OUTSIDE");
      }
      return saveNativeMarkdownFile(deps, input);
    },
  });
  const room = await open(service);
  const author = new Y.Doc();
  try {
    Y.applyUpdate(author, room.state);
    const vector = Y.encodeStateVector(author);
    author.getText("content").insert(0, "LOCAL ");
    const accepted = await service.submit({
      projectId: storage.projectAId,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, vector),
    });
    const received = new Y.Doc();
    try {
      Y.applyUpdate(received, accepted.state);
      expect(received.getText("content").toString()).toBe("LOCAL selected folder");
    } finally {
      received.destroy();
    }
    await expect(service.flush({ projectId: storage.projectAId, roomId: room.roomId })).rejects.toThrow();
    expect((await storage.svc.nativeFileProjections.read(room))?.pending).toBeInstanceOf(Uint8Array);
    await service.flush({ projectId: storage.projectAId, roomId: room.roomId });
    expect(await readFile(join(extension.root, "notes.txt"), "utf8")).toBe("LOCAL selected folder OUTSIDE");
    expect((await storage.svc.nativeFileProjections.read(room))?.pending).toBeNull();
  } finally {
    author.destroy();
  }
});

test("restart retries an unfinished file save without losing its durable editor text", async () => {
  const { deps, service } = setup();
  const room = await open(service);
  const request = { projectId: storage.projectAId, roomId: room.roomId };
  const participant = await service.presence.join({ ...request, seedId: room.seedId });
  const author = new Y.Doc();
  try {
    Y.applyUpdate(author, room.state);
    const vector = Y.encodeStateVector(author);
    author.getText("content").insert(0, "RETRY ");
    await writeFile(join(extension.root, "pause-save"), "pause");
    await service.submit({
      projectId: storage.projectAId,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, vector),
    });
    await expect(service.flush({ projectId: storage.projectAId, roomId: room.roomId })).rejects.toThrow(
      "File save paused",
    );
    await expect(service.close(request)).rejects.toThrow("File save paused");
    expect(participant.snapshot()).toHaveLength(1);
    // File failures retain the room; acknowledged text remains readable.
    const readable = new Y.Doc();
    Y.applyUpdate(readable, (await service.snapshot(request)).state);
    expect(readable.getText("content").toString()).toBe("RETRY selected folder");
    readable.destroy();
    expect((await storage.svc.nativeFileProjections.read(room))?.pending).toBeInstanceOf(Uint8Array);
    await service.dispose();
    const restarted = createService({
      storage: storage.svc,
      load: (input) => loadNativeMarkdownFile(deps, input),
      save: (input) => saveNativeMarkdownFile(deps, input),
    });
    await restarted.recover();
    expect((await storage.svc.nativeFileProjections.read(room))?.pending).toBeInstanceOf(Uint8Array);
    await rm(join(extension.root, "pause-save"));
    await restarted.recover();
    expect(await readFile(join(extension.root, "notes.txt"), "utf8")).toBe("RETRY selected folder");
    expect((await storage.svc.nativeFileProjections.read(room))?.pending).toBeNull();
    await restarted.dispose();
  } finally {
    author.destroy();
  }
});

test("an outside deletion after bytes were written survives a later save-handler failure", async () => {
  const { service } = setup();
  const room = await open(service);
  const author = new Y.Doc();
  try {
    Y.applyUpdate(author, room.state);
    const vector = Y.encodeStateVector(author);
    author.getText("content").insert(0, "EDITOR ");
    await writeFile(join(extension.root, "pause-after-write"), "pause");
    await service.submit({
      projectId: storage.projectAId,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, vector),
    });
    await expect(service.flush({ projectId: storage.projectAId, roomId: room.roomId })).rejects.toThrow(
      "after writing bytes",
    );
    expect(await readFile(join(extension.root, "notes.txt"), "utf8")).toBe("EDITOR selected folder");
    await writeFile(join(extension.root, "notes.txt"), "selected folder OUTSIDE");
    await rm(join(extension.root, "pause-after-write"));
    await service.flush({ projectId: storage.projectAId, roomId: room.roomId });
    const snapshot = await service.snapshot({ projectId: storage.projectAId, roomId: room.roomId });
    const received = new Y.Doc();
    Y.applyUpdate(received, snapshot.state);
    expect(received.getText("content").toString()).toBe("selected folder OUTSIDE");
    expect(await readFile(join(extension.root, "notes.txt"), "utf8")).toBe("selected folder OUTSIDE");
    received.destroy();
  } finally {
    author.destroy();
  }
});

test("presence stays connection-owned and never changes the durable source or editor room", async () => {
  const { service } = setup();
  const first = await open(service);
  const second = await open(service);
  const canonical = storage.svc.openNativeTextDocument({ owner: first.owner, fileId: first.documentKey });
  const before = await canonical.exportUpdate();
  const firstRequest = {
    projectId: storage.projectAId,
    roomId: first.roomId,
    documentKey: first.documentKey,
    seedId: first.seedId,
  };
  const secondRequest = { ...firstRequest, roomId: second.roomId };
  const left = await service.presence.join(firstRequest);
  const right = await service.presence.join(secondRequest);
  const selection = { anchor: "AA==", head: "AQ==" };
  await service.presence.update({ ...firstRequest, participantId: left.participantId, selection });
  expect(right.snapshot()).toHaveLength(2);
  expect(right.snapshot().find((participant) => participant.participantId === left.participantId)?.selection).toEqual(
    selection,
  );
  await expect(
    service.presence.update({ ...secondRequest, participantId: left.participantId, selection }),
  ).rejects.toThrow("not found");
  await expect(
    service.presence.update({
      ...firstRequest,
      projectId: storage.projectBId,
      participantId: left.participantId,
      selection,
    }),
  ).rejects.toThrow("not found");
  expect(await canonical.exportUpdate()).toEqual(before);
  const room = await storage.svc.nativeRooms.read({ owner: first.owner, roomId: first.roomId });
  expect(room.revision).toBe(0);
  room.document.destroy();
  await service.close(firstRequest);
  expect(right.snapshot().map((participant) => participant.participantId)).toEqual([right.participantId]);
  right.close();
  expect(right.snapshot()).toEqual([]);
});

test("native room acknowledges durable edits and recovery preserves an accepted frame before integration", async () => {
  const { deps, service } = setup();
  const joined = await open(service);
  const author = new Y.Doc();
  Y.applyUpdate(author, joined.state);
  const before = Y.encodeStateVector(author);
  saveTextDocument(author, "selected folder EDIT");
  const update = Y.encodeStateAsUpdate(author, before);
  // This is the durable boundary at which a process can stop before canonical integration.
  await storage.svc.nativeRooms.apply({ owner: joined.owner, roomId: joined.roomId, update });
  await service.dispose();
  const restartedStorage = createExtensionStorageDBService(storage.db);
  const restartedDeps = { ...deps, extensionStorageService: restartedStorage };
  const restarted = createService({
    storage: restartedStorage,
    load: (input) => loadNativeMarkdownFile(restartedDeps, input),
    save: (input) => saveNativeMarkdownFile(restartedDeps, input),
  });
  await restarted.recover();
  const restored = await open(restarted);
  const snapshot = new Y.Doc();
  Y.applyUpdate(snapshot, restored.state);
  expect(snapshot.getText("content").toString()).toBe("selected folder EDIT");
  expect(
    await restartedStorage.nativeRooms.read({ owner: joined.owner, roomId: joined.roomId }).catch(() => null),
  ).toBeNull();
  author.destroy();
  snapshot.destroy();
});

test("recovery retains an unavailable source and continues to a healthy document", async () => {
  await Bun.write(
    join(extension.root, "extension.ts"),
    `export default { views: [{
    id: "document", ref: { kind: "view", id: "document" }, title: "Document", body: { kind: "file",
      load: async (ctx, {renderer}) => {
        const path = renderer.resource.id + ".md";
        return {fileName:"note.md", documentSource:{kind:"workspace",path}, content:await ctx.workspaceFiles.readText(path)};
      },
      save: async (ctx, {renderer,content}) => ctx.workspaceFiles.writeText(renderer.resource.id + ".md",content),
    },
  }] };`,
  );
  for (const id of ["missing", "healthy"]) await writeFile(join(extension.root, `${id}.md`), id);
  const { service } = setup();
  const opened = await Promise.all(
    ["missing", "healthy"].map((id) =>
      service.open({
        ...target,
        projectId: storage.projectAId,
        resource: { type: "note", id },
      }),
    ),
  );
  await service.dispose();
  for (const room of opened) {
    const author = new Y.Doc();
    Y.applyUpdate(author, room.state);
    const before = Y.encodeStateVector(author);
    author.getText("content").insert(0, "EDIT ");
    await storage.svc.nativeRooms.apply({
      owner: room.owner,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, before),
    });
    author.destroy();
  }
  await rm(join(extension.root, "missing.md"));
  const restarted = setup().service;
  await restarted.recover();
  const retained = await storage.svc.nativeRooms.read({ owner: opened[0].owner, roomId: opened[0].roomId });
  expect(retained.document.getText("content").toString()).toBe("EDIT missing");
  retained.document.destroy();
  const removed = await storage.svc.nativeRooms
    .read({ owner: opened[1].owner, roomId: opened[1].roomId })
    .catch(() => null);
  expect(removed).toBeNull();
  expect(await readFile(join(extension.root, "healthy.md"), "utf8")).toBe("EDIT healthy");
  await writeFile(join(extension.root, "missing.md"), "missing OUTSIDE");
  await restarted.recover();
  expect(await readFile(join(extension.root, "missing.md"), "utf8")).toBe("EDIT missing OUTSIDE");
});

test("two local rooms converge and a stale frame retains edits made in both rooms", async () => {
  const { service } = setup();
  const first = await open(service);
  const second = await open(service);
  const left = new Y.Doc();
  const right = new Y.Doc();
  Y.applyUpdate(left, first.state);
  Y.applyUpdate(right, second.state);
  const baseline = Y.encodeStateVector(left);
  saveTextDocument(left, "FIRST selected folder");
  saveTextDocument(right, "selected folder LAST");
  await service.submit({
    projectId: storage.projectAId,
    roomId: first.roomId,
    update: Y.encodeStateAsUpdate(left, baseline),
  });
  const accepted = await service.submit({
    projectId: storage.projectAId,
    roomId: second.roomId,
    update: Y.encodeStateAsUpdate(right, baseline),
  });
  const snapshot = new Y.Doc();
  Y.applyUpdate(snapshot, accepted.state);
  expect(snapshot.getText("content").toString()).toBe("FIRST selected folder LAST");
  await service.close({ projectId: storage.projectAId, roomId: first.roomId });
  await expect(
    service.submit({ projectId: storage.projectAId, roomId: first.roomId, update: new Uint8Array([0, 0]) }),
  ).rejects.toThrow("not found");
  left.destroy();
  right.destroy();
  snapshot.destroy();
});

test("a room handle cannot be used through another project", async () => {
  const { service } = setup();
  const room = await open(service);
  await expect(service.snapshot({ projectId: storage.projectBId, roomId: room.roomId })).rejects.toThrow("not found");
  await expect(service.close({ projectId: storage.projectBId, roomId: room.roomId })).rejects.toThrow("not found");
});

test("a received peer insertion can anchor the next local frame without a history repair", async () => {
  const { service } = setup();
  const first = await open(service);
  const second = await open(service);
  const left = new Y.Doc();
  const right = new Y.Doc();
  Y.applyUpdate(left, first.state);
  Y.applyUpdate(right, second.state);
  const leftBefore = Y.encodeStateVector(left);
  saveTextDocument(left, "PEER selected folder");
  await service.submit({
    projectId: storage.projectAId,
    roomId: first.roomId,
    update: Y.encodeStateAsUpdate(left, leftBefore),
  });
  const received = await service.snapshot({ projectId: storage.projectAId, roomId: second.roomId });
  Y.applyUpdate(right, received.state);
  const rightBefore = Y.encodeStateVector(right);
  saveTextDocument(right, "PEER LOCAL selected folder");
  const accepted = await service.submit({
    projectId: storage.projectAId,
    roomId: second.roomId,
    update: Y.encodeStateAsUpdate(right, rightBefore),
  });
  const snapshot = new Y.Doc();
  Y.applyUpdate(snapshot, accepted.state);
  expect(snapshot.getText("content").toString()).toBe("PEER LOCAL selected folder");
  left.destroy();
  right.destroy();
  snapshot.destroy();
});

test("a reconnect retains its old source context until late frames have been accepted", async () => {
  const { service } = setup();
  const canonical = await open(service);
  const offline = new Y.Doc();
  await seedTextDocument(offline, "selected folder");
  saveTextDocument(offline, "OFFLINE selected folder");
  const joined = await service.open({
    ...target,
    projectId: storage.projectAId,
    sourceState: Y.encodeStateAsUpdate(offline),
  });
  expect(joined.seedId).toBe(canonical.seedId);
  expect(joined.sourceSeedId).not.toBe(joined.seedId);
  const before = Y.encodeStateVector(offline);
  saveTextDocument(offline, "OFFLINE selected folder LATE");
  const accepted = await service.submit({
    projectId: storage.projectAId,
    roomId: joined.roomId,
    update: Y.encodeStateAsUpdate(offline, before),
  });
  const current = new Y.Doc();
  Y.applyUpdate(current, accepted.state);
  expect(current.getText("content").toString()).toBe("OFFLINE selected folder LATE");
  expect(accepted.seedId).toBe(canonical.seedId);
  offline.destroy();
  current.destroy();
});

test("the local API opens only registered targets and persists accepted frames", async () => {
  const { service } = setup();
  const routes = createNativeDocumentRoutes(service);
  const base = `/projects/${storage.projectAId}/native-documents`;
  const request = (path: string, body: unknown) =>
    routes.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const denied = await request(base, { fileRendererId: target.fileRendererId, filePath: "/somewhere/private.md" });
  expect(denied.status).toBe(400);
  const joined = await request(base, target);
  expect(joined.status).toBe(200);
  const room = await joined.json();
  const author = new Y.Doc();
  Y.applyUpdate(author, Buffer.from(room.state, "base64"));
  const before = Y.encodeStateVector(author);
  saveTextDocument(author, "selected folder HTTP");
  const accepted = await request(`${base}/${room.documentKey}/updates`, {
    roomId: room.roomId,
    update: Buffer.from(Y.encodeStateAsUpdate(author, before)).toString("base64"),
  });
  expect(accepted.status).toBe(200);
  const body = await accepted.json();
  const current = new Y.Doc();
  Y.applyUpdate(current, Buffer.from(body.state, "base64"));
  expect(current.getText("content").toString()).toBe("selected folder HTTP");
  const wrongKey = await request(`${base}/${"0".repeat(64)}/updates`, { roomId: room.roomId, update: "AAA=" });
  expect(wrongKey.status).toBe(404);
  author.destroy();
  current.destroy();
});

test("the local document stream keeps delivering edits when the project presence rooms are full", async () => {
  const { service } = setup();
  const presenceRooms = [];
  for (let index = 0; index < 32; index++) {
    const opened = await service.open({
      ...target,
      projectId: storage.projectAId,
      pageParams: { capacity: String(index) },
    });
    presenceRooms.push(await service.presence.join({ ...opened, projectId: storage.projectAId }));
  }
  const first = await open(service);
  const second = await open(service);
  const routes = createNativeDocumentRoutes(service);
  const abort = new AbortController();
  const response = await routes.request(
    `/projects/${storage.projectAId}/native-documents/${second.documentKey}/stream?roomId=${second.roomId}`,
    { signal: abort.signal },
  );
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  const readDocument = async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error("Document stream closed before its update");
      const packet = new TextDecoder().decode(value);
      if (!packet.includes("event: document")) continue;
      const data = packet.split("\n").find((line) => line.startsWith("data: "));
      return JSON.parse(data!.slice(6));
    }
  };
  const author = new Y.Doc();
  const received = new Y.Doc();
  try {
    const initial = await readDocument();
    Y.applyUpdate(received, Buffer.from(initial.state, "base64"));
    expect(received.getText("content").toString()).toBe("selected folder");
    Y.applyUpdate(author, first.state);
    const before = Y.encodeStateVector(author);
    saveTextDocument(author, "selected folder STREAM");
    await service.submit({
      projectId: storage.projectAId,
      roomId: first.roomId,
      update: Y.encodeStateAsUpdate(author, before),
    });
    const next = await readDocument();
    Y.applyUpdate(received, Buffer.from(next.state, "base64"));
    expect(received.getText("content").toString()).toBe("selected folder STREAM");
  } finally {
    abort.abort();
    await reader.cancel();
    for (const presence of presenceRooms) presence.close();
    author.destroy();
    received.destroy();
  }
});

test("shutdown drains an admitted edit before recovery and refuses new editor work", async () => {
  const { deps, service } = setup();
  const room = await open(service);
  const author = new Y.Doc();
  Y.applyUpdate(author, room.state);
  const before = Y.encodeStateVector(author);
  saveTextDocument(author, "selected folder SHUTDOWN");
  const saving = service.submit({
    projectId: storage.projectAId,
    roomId: room.roomId,
    update: Y.encodeStateAsUpdate(author, before),
  });
  await service.dispose();
  await saving;
  await expect(open(service)).rejects.toThrow("closed");
  const resumed = createService({
    storage: storage.svc,
    load: (input) => loadNativeMarkdownFile(deps, input),
    save: (input) => saveNativeMarkdownFile(deps, input),
  });
  await resumed.recover();
  const restored = await open(resumed);
  const snapshot = new Y.Doc();
  Y.applyUpdate(snapshot, restored.state);
  expect(snapshot.getText("content").toString()).toBe("selected folder SHUTDOWN");
  author.destroy();
  snapshot.destroy();
});

test("reconnect acknowledges pending raw editor frames from their received baseline", async () => {
  const { service } = setup();
  const room = await open(service);
  const author = new Y.Doc();
  Y.applyUpdate(author, room.state);
  const before = Y.encodeStateVector(author);
  author.getText("content").insert(0, "OFFLINE ");
  const pendingUpdate = Y.encodeStateAsUpdate(author, before);
  const joined = await service.open({
    ...target,
    projectId: storage.projectAId,
    sourceState: room.state,
    pendingUpdate,
  });
  const snapshot = new Y.Doc();
  Y.applyUpdate(snapshot, joined.state);
  expect(snapshot.getText("content").toString()).toBe("OFFLINE selected folder");
  author.destroy();
  snapshot.destroy();
});

test("the browser client receives live participants and stream cancellation removes its connection", async () => {
  const { service } = setup();
  const routes = new Hono().route("/v1", createNativeDocumentRoutes(service));
  const client = createClient({
    baseUrl: "http://localhost",
    fetch: ((url, init) => routes.fetch(new Request(String(url), init))) as typeof fetch,
  }).nativeDocuments;
  const left = await client.open({ projectId: storage.projectAId, target });
  const right = await client.open({ projectId: storage.projectAId, target });
  const leftReady = Promise.withResolvers<string>();
  const rightReady = Promise.withResolvers<string>();
  const peerSelection = Promise.withResolvers<void>();
  const peerLeft = Promise.withResolvers<void>();
  const leftAbort = new AbortController();
  const rightAbort = new AbortController();
  let leftId: string | undefined;
  let leaving = false;
  const watchLeft = client.watch({
    ...left,
    projectId: storage.projectAId,
    signal: leftAbort.signal,
    onSnapshot() {},
    onPresence(snapshot) {
      leftId = snapshot.participantId;
      leftReady.resolve(leftId);
    },
  });
  const watchRight = client.watch({
    ...right,
    projectId: storage.projectAId,
    signal: rightAbort.signal,
    onSnapshot() {},
    onPresence(snapshot) {
      rightReady.resolve(snapshot.participantId);
      const peer = snapshot.participants.find((participant) => participant.participantId === leftId);
      if (peer?.selection?.anchor === "AA==") peerSelection.resolve();
      if (leaving && !peer) peerLeft.resolve();
    },
  });
  void watchLeft.catch((error) => leftReady.reject(error));
  void watchRight.catch((error) => {
    rightReady.reject(error);
    peerSelection.reject(error);
    peerLeft.reject(error);
  });
  try {
    const [participantId] = await Promise.all([leftReady.promise, rightReady.promise]);
    await client.presence({
      ...left,
      projectId: storage.projectAId,
      participantId,
      seedId: left.seedId,
      selection: { anchor: "AA==", head: "AQ==" },
    });
    await peerSelection.promise;
    leaving = true;
    leftAbort.abort();
    await watchLeft;
    await peerLeft.promise;
  } finally {
    leftAbort.abort();
    rightAbort.abort();
    await Promise.allSettled([watchLeft, watchRight]);
  }
});

test("the browser client uses the local API for binary edits and document streams", async () => {
  const { service } = setup();
  const routes = new Hono().route("/v1", createNativeDocumentRoutes(service));
  const client = createClient({
    baseUrl: "http://localhost",
    fetch: ((url, init) => routes.fetch(new Request(String(url), init))) as typeof fetch,
  }).nativeDocuments;
  const room = await client.open({ projectId: storage.projectAId, target });
  const author = new Y.Doc();
  Y.applyUpdate(author, room.state);
  const initial = Promise.withResolvers<void>();
  const changed = Promise.withResolvers<void>();
  const abort = new AbortController();
  const watching = client.watch({
    projectId: storage.projectAId,
    documentKey: room.documentKey,
    roomId: room.roomId,
    signal: abort.signal,
    onSnapshot(snapshot) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot.state);
      if (doc.getText("content").toString().endsWith(" CLIENT")) changed.resolve();
      else initial.resolve();
      doc.destroy();
    },
  });
  watching.catch((error) => {
    initial.reject(error);
    changed.reject(error);
  });
  try {
    await initial.promise;
    const before = Y.encodeStateVector(author);
    author.getText("content").insert(author.getText("content").length, " CLIENT");
    await client.submit({
      projectId: storage.projectAId,
      documentKey: room.documentKey,
      roomId: room.roomId,
      update: Y.encodeStateAsUpdate(author, before),
    });
    await changed.promise;
  } finally {
    abort.abort();
    await watching;
    await client.close({ projectId: storage.projectAId, documentKey: room.documentKey, roomId: room.roomId });
    author.destroy();
  }
});
