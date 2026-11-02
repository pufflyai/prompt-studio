import type { NativeTextTarget } from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import { readTextDocumentSeed } from "pstdio-sync/text";
import * as Y from "yjs";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { createNativeProjectionQueue } from "./projection-queue";
export interface Room {
  target: NativeTextTarget;
  editable: boolean;
  owner: StorageOwner;
  documentKey: string;
  queue: Promise<unknown>;
  closeWatchers: Set<() => void>;
}
export interface RoomRequest {
  projectId: string;
  roomId: string;
  documentKey?: string;
}

export const createNativeRoomSnapshot = (
  storage: ExtensionsRouteDeps["extensionStorageService"],
  files: ReturnType<typeof createNativeProjectionQueue>,
) => {
  const snapshot = async (room: Room, roomId: string) => {
    const { state, revision } = await storage
      .openNativeTextDocument({ owner: room.owner, fileId: room.documentKey })
      .snapshot();
    const document = new Y.Doc();
    try {
      Y.applyUpdate(document, state);
      const seedId = (await readTextDocumentSeed(document)).id;
      const source = await storage.nativeRooms.read({ owner: room.owner, roomId });
      try {
        const sourceSeedId = (await readTextDocumentSeed(source.document)).id;
        if (sourceSeedId === seedId) {
          // Persist the history sent to this browser before it can anchor its next edit.
          // Received updates retain their existing provenance rather than becoming local intent.
          await storage.nativeRooms.receive({
            owner: room.owner,
            roomId,
            update: Y.encodeStateAsUpdate(document, Y.encodeStateVector(source.document)),
          });
        }
        if (room.editable) void files.request(room).catch(() => {});
        return {
          state,
          revision,
          seedId,
          sourceSeedId,
          ...(sourceSeedId !== seedId && { sourceState: Y.encodeStateAsUpdate(source.document) }),
        };
      } finally {
        source.document.destroy();
      }
    } finally {
      document.destroy();
    }
  };
  return snapshot;
};
