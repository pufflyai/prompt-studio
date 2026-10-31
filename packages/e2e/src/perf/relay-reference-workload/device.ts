import assert from "node:assert/strict";
import { join } from "node:path";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { createSyncSpace, openState, openUpdate, type StorageOwner } from "pstdio-sync";
import { createDocumentRelay, createRecordStreamSync, decodeRecordFrame } from "pstdio-sync/relay";
import type { Asset } from "pstdio-sync-contracts";
import type { deploy } from "./deployment";
import { createFiles } from "./files";
import type { observeTraffic } from "./traffic";

export interface OwnerInput {
  owner: StorageOwner;
  secret: string;
  chunks: Set<string>;
  frames: Set<string>;
  files: Set<string>;
}

export const createDevice = async (input: {
  name: string;
  account: string;
  directory: string;
  deployment: Awaited<ReturnType<typeof deploy>>;
  traffic: ReturnType<typeof observeTraffic>;
  units: Map<string, OwnerInput>;
}) => {
  // This is a new, isolated test database, never the user's running PGlite database.
  const { db, close } = await createDb({ path: ":memory:" });
  const storage = createExtensionStorageDBService(db);
  const files = await createFiles(join(input.directory, input.name)).catch(async (error) => {
    await close();
    throw error;
  });
  const knownProjects = new Set<string>();
  return {
    files,
    async owner(unit: OwnerInput) {
      const { owner, secret, chunks, frames, files: fileIds } = unit;
      if (!knownProjects.has(owner.workbenchId)) {
        const now = new Date().toISOString();
        await db.insert(projects).values({
          id: owner.workbenchId,
          name: "PS787 measurement",
          shorthand: "M",
          created_at: now,
          updated_at: now,
        });
        knownProjects.add(owner.workbenchId);
      }
      const space = await createSyncSpace({
        projectId: owner.workbenchId,
        spaceOwner: null,
        keys: [{ generation: 1, secret }],
      });
      const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
      input.units.set(documentId, unit);
      const token = await input.deployment.token(input.account, owner.workbenchId, input.name);
      input.traffic.actor(token, input.name);
      const relay = createDocumentRelay({
        origin: input.deployment.origin,
        space,
        documentId,
        token: async () => token,
        signal: input.deployment.signal,
      });
      const sync = createRecordStreamSync({
        space,
        documentId,
        assets: files.store,
        store: storage.documents.recordStream(owner),
        relay: {
          ...relay,
          async update(update) {
            const frame = decodeRecordFrame(await openUpdate(space, documentId, update));
            if (frame.blob) frames.add(frame.blob.blobId);
            for (const id of update.blobIds) if (id !== frame.blob?.blobId) fileIds.add(id);
            return relay.update(update);
          },
          async replace(state) {
            const accepted = await relay.replace(state);
            if (accepted) {
              const bytes = await openState(
                space,
                documentId,
                state,
                new Uint8Array(Buffer.from(state.payload, "base64")),
              );
              const manifest = JSON.parse(new TextDecoder().decode(bytes)) as { chunks: { blobId: string }[] };
              for (const chunk of manifest.chunks) chunks.add(chunk.blobId);
              const current = new Set(manifest.chunks.map((chunk) => chunk.blobId));
              for (const id of state.blobIds) if (!current.has(id)) fileIds.add(id);
            }
            return accepted;
          },
        },
        quarantine: async () => {
          throw new Error("A record or asset was quarantined during the measurement");
        },
      });
      const { records } = await storage.open({ owner, assets: files.store });
      return {
        documentId,
        records,
        sync,
        async verify(count: number, edited: boolean, assets: Map<number, Asset>, edits: number) {
          const rows = await records.list();
          assert.equal(rows.length, count);
          const byId = new Map(rows.map((row) => [row.recordId, row]));
          for (let index = 0; index < count; index++) {
            const record = byId.get(`record-${index}`)!;
            const lastEdit = index + Math.floor((edits - 1 - index) / count) * count;
            assert.deepEqual(record.value, value(index, edited ? lastEdit : undefined));
            assert.equal(record.deleted, false);
            if (assets.has(index)) assert.deepEqual(record.asset, assets.get(index));
          }
          await files.store.verifyComplete([...assets.values()]);
          assert.deepEqual(await sync.status(), { downloaded: true, pending: false, needsAttention: false });
        },
      };
    },
    async close() {
      try {
        await close();
      } finally {
        await files.clear();
      }
    },
  };
};

export const value = (index: number, edit?: number) => ({
  marker: "PS787 private reference title",
  index,
  edit: edit ?? -1,
  // Replacing the text exercises real Yjs updates and the default owner-level compaction rule.
  text: edit === undefined ? "initial reference text\n".repeat(48) : `changed ${edit} reference text\n`.repeat(96),
});
