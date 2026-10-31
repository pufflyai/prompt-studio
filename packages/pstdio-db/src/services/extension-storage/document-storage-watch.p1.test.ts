import { afterEach, expect, test } from "bun:test";
import type { StorageOwner } from "pstdio-sync";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createDocumentSync, createRecordStreamSync } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createAssets, createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const projectId = crypto.randomUUID();
const owner = { workbenchId: projectId, extensionId: "ext.notes" };
const textName = JSON.stringify(["text-file", "note.md"]);
const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [{ generation: 1, secret: "A".repeat(43) }] });

const relays = new Map<string, ReturnType<typeof createRelay>["relay"]>();
const relayFor = (documentId: string) => {
  let relay = relays.get(documentId);
  if (!relay) {
    relay = createRelay().relay;
    relays.set(documentId, relay);
  }
  return relay;
};

// One device: its own database, and the same syncs the relay owner connection runs for one extension.
const device = async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const timestamp = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: projectId, name: "Notes", shorthand: "N", created_at: timestamp, updated_at: timestamp });
  const service = createDocumentStorageDBService(db);
  const assets = createAssets();
  const quarantine = async () => {};
  const documentSync = async (name: string) => {
    const documentId = await space.documentId(JSON.stringify([owner.extensionId, name]));
    return createDocumentSync({
      owner,
      space,
      documentId,
      store: service.documents.open(name),
      relay: relayFor(documentId),
      quarantine,
    });
  };
  const recordStreamId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const syncs = {
    owner: await documentSync("records"),
    text: await documentSync(textName),
    records: createRecordStreamSync({
      space,
      documentId: recordStreamId,
      relay: relayFor(recordStreamId),
      store: service.documents.recordStream(owner),
      assets: assets.store,
      quarantine,
    }),
  };
  const notified: StorageOwner[] = [];
  const stop = service.watch((changed) => notified.push(changed));
  cleanup.push(async () => stop());
  return {
    records: service.open({ owner, assets: assets.store }).records,
    text: service.openTextDocument({ owner, fileId: "note.md" }),
    notified,
    syncs,
    synchronize: async () => {
      for (const sync of Object.values(syncs)) await sync.synchronize();
    },
  };
};

test("remote edits imported by sync notify storage watchers, and a round with no remote edits notifies nothing", async () => {
  const first = await device();
  const second = await device();
  await second.synchronize();
  const quiet = second.notified.length;

  await first.records.commit({ operationId: "save", edits: [{ recordId: "ticket", replace: { title: "Remote" } }] });
  await first.text.save("remote text");
  await first.synchronize();

  // Each import path commits through the same storage transaction that local writes use.
  await second.syncs.records.synchronize();
  expect((await second.records.read("ticket")).value).toEqual({ title: "Remote" });
  expect(second.notified.slice(quiet)).toEqual([owner]);
  await second.syncs.text.synchronize();
  expect(await second.text.read()).toBe("remote text");
  expect(second.notified.slice(quiet)).toEqual([owner, owner]);

  const imported = second.notified.length;
  await second.synchronize();
  expect(second.notified.length).toBe(imported);
});
