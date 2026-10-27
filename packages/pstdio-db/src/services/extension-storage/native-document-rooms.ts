import { and, eq, gt } from "drizzle-orm";
import { type NativeDocumentTarget, nativeDocumentTargetSchema } from "pstdio-api-contracts";
import { applyTextEditorUpdate, readTextDocumentSeed, type StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { native_document_room_updates, native_document_rooms, native_document_sources } from "../../db/schemas.pg";
import { createDocumentCache } from "./document-cache";
import { NativeDocumentRoomError } from "./native-document-errors";

interface RoomAddress {
  owner: StorageOwner;
  roomId: string;
}
const roomWhere = ({ owner, roomId }: RoomAddress) =>
  and(
    eq(native_document_rooms.id, roomId),
    eq(native_document_rooms.workbench_id, owner.workbenchId),
    eq(native_document_rooms.extension_id, owner.extensionId),
  );
const sourceWhere = ({ owner, documentKey }: { owner: StorageOwner; documentKey: string }) =>
  and(
    eq(native_document_sources.workbench_id, owner.workbenchId),
    eq(native_document_sources.extension_id, owner.extensionId),
    eq(native_document_sources.document_key, documentKey),
  );
const validate = async (document: Y.Doc) => {
  if (document.store.pendingStructs || document.store.pendingDs)
    throw new NativeDocumentRoomError("missing_history", "The editor source is missing causal history");
  return readTextDocumentSeed(document);
};
const copy = (document: Y.Doc) => {
  const snapshot = new Y.Doc();
  Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(document));
  return snapshot;
};
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const append = async (
  tx: Transaction,
  input: RoomAddress,
  row: { id: string; revision: number; folded_revision: number },
  document: Y.Doc,
  updates: Uint8Array[],
) => {
  if (!updates.length) return row.revision;
  const revision = row.revision + 1;
  await tx.insert(native_document_room_updates).values({ room_id: row.id, revision, update: Y.mergeUpdates(updates) });
  const fold = revision - row.folded_revision >= 128;
  await tx
    .update(native_document_rooms)
    .set({
      revision,
      ...(fold && { state: Y.encodeStateAsUpdate(document), folded_revision: revision }),
    })
    .where(roomWhere(input));
  if (fold) await tx.delete(native_document_room_updates).where(eq(native_document_room_updates.room_id, row.id));
  return revision;
};

export const createNativeDocumentRoomsDBService = (db: DbClient) => {
  const cache = createDocumentCache();
  const access = async <T>(input: RoomAddress, action: (document: Y.Doc) => Promise<T>) => {
    const key = JSON.stringify([input.owner, input.roomId]);
    let loaded: Y.Doc | undefined;
    try {
      const result = await db.transaction(async (tx) => {
        const [row] = await tx
          .select({
            id: native_document_rooms.id,
            document_key: native_document_rooms.document_key,
            revision: native_document_rooms.revision,
            folded_revision: native_document_rooms.folded_revision,
          })
          .from(native_document_rooms)
          .where(roomWhere(input))
          .for("update");
        if (!row) throw new NativeDocumentRoomError("not_found", "Editor room not found");
        const cached = cache.get(key);
        const document = cached?.revision === row.revision ? cached.document : new Y.Doc();
        loaded = document;
        if (document !== cached?.document) {
          const [saved] = await tx
            .select({ state: native_document_rooms.state })
            .from(native_document_rooms)
            .where(roomWhere(input));
          Y.applyUpdate(document, saved.state);
          const tail = await tx
            .select({ update: native_document_room_updates.update })
            .from(native_document_room_updates)
            .where(eq(native_document_room_updates.room_id, row.id))
            .orderBy(native_document_room_updates.revision);
          for (const { update } of tail) Y.applyUpdate(document, update);
        }
        const updates: Uint8Array[] = [];
        const capture = (update: Uint8Array) => updates.push(update);
        document.on("update", capture);
        let value: T;
        try {
          value = await action(document);
        } finally {
          document.off("update", capture);
        }
        const revision = await append(tx, input, row, document, updates);
        return { value, document, revision, documentKey: row.document_key };
      });
      cache.publish(key, result);
      return result;
    } catch (error) {
      if (loaded !== cache.get(key)?.document) loaded?.destroy();
      cache.discard(key);
      throw error;
    }
  };
  const apply = async (input: RoomAddress & { update: Uint8Array }, authored: boolean) => {
    const result = await access(input, async (document) => {
      const seed = await validate(document);
      try {
        if (authored) applyTextEditorUpdate(document, input.update);
        else Y.applyUpdate(document, input.update);
        if ((await validate(document)).id !== seed.id)
          throw new NativeDocumentRoomError("history_changed", "Editor frame changes its initial history");
      } catch (error) {
        if (error instanceof NativeDocumentRoomError) throw error;
        throw new NativeDocumentRoomError("invalid_frame", "Invalid editor frame");
      }
    });
    return { revision: result.revision, documentKey: result.documentKey };
  };
  return {
    async create(input: { owner: StorageOwner; documentKey: string; target: NativeDocumentTarget; state: Uint8Array }) {
      const parsed = nativeDocumentTargetSchema.parse(input.target);
      const target = { ...parsed, resource: parsed.resource };
      if (!/^[a-f0-9]{64}$/.test(input.documentKey))
        throw new Error("The resolved text source has an invalid document key");
      const document = new Y.Doc();
      try {
        try {
          Y.applyUpdate(document, input.state);
          await validate(document);
        } catch (error) {
          if (error instanceof NativeDocumentRoomError) throw error;
          throw new NativeDocumentRoomError("invalid_frame", "Invalid editor source");
        }
        const id = crypto.randomUUID();
        await db.transaction(async (tx) => {
          await tx
            .insert(native_document_sources)
            .values({
              workbench_id: input.owner.workbenchId,
              extension_id: input.owner.extensionId,
              document_key: input.documentKey,
              target,
            })
            .onConflictDoNothing();
          await tx.insert(native_document_rooms).values({
            id,
            workbench_id: input.owner.workbenchId,
            extension_id: input.owner.extensionId,
            document_key: input.documentKey,
            state: Y.encodeStateAsUpdate(document),
          });
        });
        cache.publish(JSON.stringify([input.owner, id]), { document, revision: 0 });
        return { id };
      } catch (error) {
        document.destroy();
        throw error;
      }
    },
    async read(input: RoomAddress) {
      const result = await access(input, async (document) => copy(document));
      return { document: result.value, revision: result.revision, documentKey: result.documentKey };
    },
    apply: (input: RoomAddress & { update: Uint8Array }) => apply(input, true),
    receive: (input: RoomAddress & { update: Uint8Array }) => apply(input, false),
    async remove(input: RoomAddress) {
      const removed = await db
        .delete(native_document_rooms)
        .where(roomWhere(input))
        .returning({ id: native_document_rooms.id });
      cache.discard(JSON.stringify([input.owner, input.roomId]));
      return removed.length > 0;
    },
    async source(input: { owner: StorageOwner; documentKey: string }) {
      const [row] = await db
        .select({ target: native_document_sources.target })
        .from(native_document_sources)
        .where(sourceWhere(input));
      return row?.target;
    },
    async *pending() {
      let cursor: string | undefined;
      while (true) {
        const rows = await db
          .select({
            id: native_document_rooms.id,
            workbenchId: native_document_rooms.workbench_id,
            extensionId: native_document_rooms.extension_id,
            documentKey: native_document_rooms.document_key,
          })
          .from(native_document_rooms)
          .where(cursor ? gt(native_document_rooms.id, cursor) : undefined)
          .orderBy(native_document_rooms.id)
          .limit(100);
        for (const { id, workbenchId, extensionId, documentKey } of rows)
          yield { id, owner: { workbenchId, extensionId }, documentKey };
        if (rows.length < 100) return;
        cursor = rows.at(-1)!.id;
      }
    },
  };
};
