import { and, eq, gt, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type NativeTextTarget, nativeTextTargetSchema } from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import { applyTextEditorUpdate, readTextDocumentSeed } from "pstdio-sync/text";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { documents } from "../../db/schemas/documents";
import { owners as storageOwners } from "../../db/schemas/owners";
import { assertStorageOwnerAdmitted, storageOwnerAdmissionPending } from "../../db/storage-admission";
import { createDocumentCache } from "./document-cache";
import { fileDocumentWhere, loadFileDocument, saveFileDocument } from "./document-file-persistence";
import { documentFilesFor, trackDocumentFiles } from "./document-files";
import { nativeDocumentId, roomDocumentId } from "./document-kind";
import { NativeDocumentRoomError } from "./native-document-errors";
import { externalRoomId, insertNativeRoom, nativeKeyFromId } from "./native-document-files";
import {
  orderedRoomMarkerId,
  removeRoomGeneration,
  roomGeneration,
  saveOrderedMarker,
} from "./ordered-native-metadata";

interface RoomAddress {
  owner: StorageOwner;
  roomId: string;
}
const source = alias(documents, "room_source");
const roomWhere = ({ owner, roomId }: RoomAddress) =>
  and(eq(documents.kind, "room"), fileDocumentWhere(owner, roomDocumentId(roomId)));
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
export const createNativeDocumentRoomsDBService = (db: DbClient) => {
  const cache = createDocumentCache();
  const access = async <T>(input: RoomAddress, action: (document: Y.Doc) => Promise<T>) => {
    assertStorageOwnerAdmitted(db, input.owner);
    let key = JSON.stringify([input.owner, input.roomId]);
    let loaded: Y.Doc | undefined;
    try {
      const result = await db.transaction(async (tx) => {
        const [saved] = await tx
          .select({ room: documents, sourceKey: source.key })
          .from(documents)
          .innerJoin(
            source,
            and(eq(source.id, documents.room_of), eq(source.owner_id, documents.owner_id), ne(source.kind, "room")),
          )
          .where(roomWhere(input))
          .for("update");
        if (!saved) throw new NativeDocumentRoomError("not_found", "Editor room not found");
        const row = saved.room;
        key = JSON.stringify([row.owner_id, input.roomId]);
        const cached = cache.get(key);
        const files = documentFilesFor(tx);
        const document =
          cached?.revision === row.revision
            ? cached.document
            : (await loadFileDocument(files, input.owner.workbenchId, row)).document;
        loaded = document;
        const updates: Uint8Array[] = [];
        const capture = (update: Uint8Array) => updates.push(update);
        document.on("update", capture);
        let value: T;
        try {
          value = await action(document);
        } finally {
          document.off("update", capture);
        }
        const revision = await saveFileDocument(tx, files, {
          projectId: input.owner.workbenchId,
          row,
          document,
          updates,
        });
        return {
          value,
          document,
          ownerId: row.owner_id,
          revision,
          documentKey: nativeKeyFromId(saved.sourceKey),
          generation: await roomGeneration(tx, input.owner, input.roomId),
        };
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
    async create(input: {
      owner: StorageOwner;
      documentKey: string;
      target: NativeTextTarget;
      state: Uint8Array;
      writable?: boolean;
      generation?: string;
    }) {
      assertStorageOwnerAdmitted(db, input.owner);
      const parsed = nativeTextTargetSchema.parse(input.target);
      const normalized = "fileRendererId" in parsed ? { ...parsed, resource: parsed.resource } : parsed;
      const target = input.writable === false ? null : normalized;
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
        const ownerId = await db.transaction(async (tx) => {
          const row = await insertNativeRoom(tx, { ...input, id, target, state: Y.encodeStateAsUpdate(document) });
          if (input.generation !== undefined)
            await saveOrderedMarker(tx, input.owner, orderedRoomMarkerId(id), { generation: input.generation });
          return row.owner_id;
        });
        cache.publish(JSON.stringify([ownerId, id]), { document, ownerId, revision: 0 });
        return { id };
      } catch (error) {
        document.destroy();
        throw error;
      }
    },
    async read(input: RoomAddress) {
      const result = await access(input, async (document) => copy(document));
      return {
        document: result.value,
        revision: result.revision,
        documentKey: result.documentKey,
        generation: result.generation,
      };
    },
    apply: (input: RoomAddress & { update: Uint8Array }) => apply(input, true),
    receive: (input: RoomAddress & { update: Uint8Array }) => apply(input, false),
    async remove(input: RoomAddress) {
      assertStorageOwnerAdmitted(db, input.owner);
      const removed = await db.transaction(async (tx) => {
        const removed = await tx
          .delete(documents)
          .where(roomWhere(input))
          .returning({ id: documents.id, owner_id: documents.owner_id });
        for (const row of removed) trackDocumentFiles(tx, input.owner.workbenchId, row.id);
        if (removed.length) await removeRoomGeneration(tx, input.owner, input.roomId);
        return removed;
      });
      for (const row of removed) cache.discard(JSON.stringify([row.owner_id, input.roomId]));
      return removed.length > 0;
    },
    async source(input: { owner: StorageOwner; documentKey: string }) {
      assertStorageOwnerAdmitted(db, input.owner);
      const [row] = await db
        .select({ target: documents.target })
        .from(documents)
        .where(fileDocumentWhere(input.owner, nativeDocumentId(input.documentKey)));
      return row?.target;
    },
    async *pending() {
      let cursor: number | undefined;
      while (true) {
        const rows = await db
          .select({
            internalId: documents.id,
            key: documents.key,
            workbenchId: storageOwners.project_id,
            extensionId: storageOwners.extension_id,
            sourceKey: source.key,
          })
          .from(documents)
          .innerJoin(storageOwners, eq(storageOwners.id, documents.owner_id))
          .innerJoin(
            source,
            and(eq(source.id, documents.room_of), eq(source.owner_id, documents.owner_id), ne(source.kind, "room")),
          )
          .where(and(eq(documents.kind, "room"), cursor ? gt(documents.id, cursor) : undefined))
          .orderBy(documents.id)
          .limit(100);
        for (const { key, workbenchId, extensionId, sourceKey } of rows) {
          const id = externalRoomId(key);
          const documentKey = nativeKeyFromId(sourceKey);
          if (storageOwnerAdmissionPending(db, { workbenchId, extensionId })) continue;
          const generation = await roomGeneration(db, { workbenchId, extensionId }, id);
          yield {
            id,
            owner: { workbenchId, extensionId },
            documentKey,
            ...(generation === undefined ? {} : { generation }),
          };
        }
        if (rows.length < 100) return;
        cursor = rows.at(-1)!.internalId;
      }
    },
  };
};
