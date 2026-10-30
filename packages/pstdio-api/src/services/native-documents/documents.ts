import type { NativeDocumentSelection, NativeTextTarget } from "pstdio-api-contracts";
import { NativeDocumentRoomError } from "pstdio-db";
import {
  NativeSourcePendingError,
  NativeSourceRecoveryError,
  NativeSourceRetiredError,
  type StorageOwner,
  StorageRevisionChangedError,
} from "pstdio-sync";
import { readTextDocumentSeed } from "pstdio-sync/text";
import * as Y from "yjs";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";
import { createNativeFileProjector } from "./file-projection";
import { type loadNativeMarkdownFile, NativeDocumentSourceError, type saveNativeMarkdownFile } from "./file-source";
import { createNativeProjectionQueue } from "./projection-queue";
import { watchNativeProjections } from "./projection-watch";
import { validateReplaySource } from "./replay-source";
import { integrateNativeRoom } from "./room-integration";
import { createNativeSessionPresence } from "./session-presence";
import { nativeAdmissionTarget, validateWritableSource } from "./validate-writable-source";

interface Room {
  target: NativeTextTarget;
  editable: boolean;
  owner: StorageOwner;
  documentKey: string;
  queue: Promise<unknown>;
  closeWatchers: Set<() => void>;
}
interface RoomRequest {
  projectId: string;
  roomId: string;
  documentKey?: string;
}

const recoverSource = async (documentKey: string, action: () => Promise<unknown>) => {
  try {
    await action();
  } catch (error) {
    if (
      !(
        error instanceof NativeDocumentSourceError ||
        error instanceof NativeSourcePendingError ||
        error instanceof NativeSourceRecoveryError ||
        error instanceof NativeSourceRetiredError ||
        error instanceof StorageRevisionChangedError
      )
    )
      throw error;
    apiLogger.warn(
      { event: "native_document.recovery.pending", documentKey, err: error },
      "Shared text recovery is pending. Saved edits and file copies were retained.",
    );
  }
};

/** Acknowledgements follow both room persistence and canonical integration. */
export const createNativeDocumentService = (deps: {
  storage: ExtensionsRouteDeps["extensionStorageService"];
  load: (input: Parameters<typeof loadNativeMarkdownFile>[1]) => ReturnType<typeof loadNativeMarkdownFile>;
  save: (input: Parameters<typeof saveNativeMarkdownFile>[1]) => ReturnType<typeof saveNativeMarkdownFile>;
  initialize: (loaded: Awaited<ReturnType<typeof loadNativeMarkdownFile>>) => Promise<void>;
  deviceId: string;
  presenceIdentity: () => Promise<{ label: string; deviceName: string }>;
}) => {
  const storage = deps.storage;
  const projection = createNativeFileProjector(deps);
  const files = createNativeProjectionQueue({
    reconcile: projection.reconcile,
    failed: ({ documentKey }, error) =>
      apiLogger.warn(
        { event: "native_document.projection.pending", documentKey, error },
        "Shared text is saved. Its file projection will retry on the next change or flush.",
      ),
  });
  const presence = createNativeSessionPresence({ deviceId: deps.deviceId, identity: deps.presenceIdentity });
  const rooms = new Map<string, Room>();
  const sourceListeners = new Set<(owner: StorageOwner, name: string) => void>();
  const pending = new Set<Promise<unknown>>();
  let closed = false;
  const track = <T>(action: () => Promise<T>) => {
    if (closed) return Promise.reject(new Error("Native document service is closed"));
    const work = Promise.resolve().then(action);
    pending.add(work);
    void work.finally(() => pending.delete(work)).catch(() => {});
    return work;
  };
  const stopProjectionWatch = watchNativeProjections(storage, files.request, track);
  const canonical = (room: Pick<Room, "owner" | "documentKey">) =>
    storage.openNativeTextDocument({ owner: room.owner, fileId: room.documentKey });
  const integrate = (owner: StorageOwner, roomId: string) => integrateNativeRoom(storage, owner, roomId);
  const snapshot = async (room: Room, roomId: string) => {
    const { state, revision } = await canonical(room).snapshot();
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
  const roomFor = (request: RoomRequest) => {
    const room = rooms.get(request.roomId);
    if (
      !room ||
      room.owner.workbenchId !== request.projectId ||
      (request.documentKey && room.documentKey !== request.documentKey)
    )
      throw new NativeDocumentRoomError("not_found", "Editor room not found");
    return room;
  };
  const run = <T>(request: RoomRequest, action: (room: Room) => Promise<T>) =>
    track(async () => {
      const room = roomFor(request);
      const result = room.queue.then(() => action(room));
      room.queue = result.catch(() => {});
      return result;
    });
  return {
    sources: {
      current(owner: StorageOwner) {
        return [
          ...new Set(
            [...rooms.values()]
              .filter(
                (room) => room.owner.workbenchId === owner.workbenchId && room.owner.extensionId === owner.extensionId,
              )
              .map((room) => JSON.stringify(["native-markdown", room.documentKey])),
          ),
        ];
      },
      watch(listener: (owner: StorageOwner, name: string) => void) {
        sourceListeners.add(listener);
        return () => {
          sourceListeners.delete(listener);
        };
      },
    },
    live: presence.live,
    presence: {
      join(input: RoomRequest & { seedId: string }) {
        return track(() => presence.join(roomFor(input), input));
      },
      update(input: RoomRequest & { participantId: string; seedId: string; selection: NativeDocumentSelection }) {
        return track(async () => {
          roomFor(input);
          presence.update(input);
        });
      },
    },
    open(
      input: NativeTextTarget & {
        projectId: string;
        signal?: AbortSignal;
        sourceState?: Uint8Array;
        pendingUpdate?: Uint8Array;
      },
    ) {
      return track(async () => {
        if (input.pendingUpdate && !input.sourceState)
          throw new NativeDocumentRoomError("invalid_frame", "Pending editor frames need their original history");
        const loaded = await deps.load(input);
        validateReplaySource(input.sourceState, loaded.documentKey, loaded.lifetime);
        if (input.pendingUpdate && loaded.content.editable === false)
          throw new NativeDocumentSourceError(403, "source_read_only", "The text source is read only");
        await deps.initialize(loaded);
        const text = canonical(loaded);
        const { id: roomId } = await storage.nativeRooms.create({
          owner: loaded.owner,
          documentKey: loaded.documentKey,
          target: loaded.projectionTarget,
          writable: loaded.content.editable !== false,
          state: input.sourceState ?? (await text.exportUpdate()),
        });
        const room: Room = {
          target: nativeAdmissionTarget(input),
          editable: loaded.content.editable !== false,
          owner: loaded.owner,
          documentKey: loaded.documentKey,
          queue: Promise.resolve(),
          closeWatchers: new Set(),
        };
        if (room.editable) await projection.initialize(room, loaded);
        if (input.pendingUpdate)
          await storage.nativeRooms.apply({ owner: room.owner, roomId, update: input.pendingUpdate });
        // A reconnect can carry edits from a retired source history. Preserve that history
        // first; recovery can finish integration if the process stops here.
        await integrate(room.owner, roomId);
        const initial = await snapshot(room, roomId);
        rooms.set(roomId, room);
        for (const listener of sourceListeners)
          listener(room.owner, JSON.stringify(["native-markdown", room.documentKey]));
        return {
          roomId,
          owner: room.owner,
          documentKey: room.documentKey,
          content: loaded.content,
          ...initial,
        };
      });
    },
    submit(input: RoomRequest & { update: Uint8Array }) {
      return run(input, async (room) => {
        await validateWritableSource(deps.load, room);
        await storage.nativeRooms.apply({
          owner: room.owner,
          roomId: input.roomId,
          update: input.update,
        });
        await integrate(room.owner, input.roomId);
        return snapshot(room, input.roomId);
      });
    },
    snapshot(input: RoomRequest) {
      return run(input, (room) => snapshot(room, input.roomId));
    },
    flush(input: RoomRequest) {
      return run(input, (room) => files.request(room));
    },
    watch(input: RoomRequest, changed: () => void, onClose?: () => void) {
      return run(input, async (room) => {
        const stop = canonical(room).watch(changed);
        const close = () => {
          unsubscribe();
          onClose?.();
        };
        const unsubscribe = () => {
          stop();
          room.closeWatchers.delete(close);
        };
        room.closeWatchers.add(close);
        return unsubscribe;
      });
    },
    close(input: RoomRequest) {
      return run(input, async (room) => {
        await integrate(room.owner, input.roomId);
        if (room.editable) await files.request(room);
        await storage.nativeRooms.remove({ owner: room.owner, roomId: input.roomId });
        presence.closeRoom(input.roomId);
        for (const close of room.closeWatchers) close();
        rooms.delete(input.roomId);
      });
    },
    recover() {
      return track(async () => {
        if (rooms.size) throw new Error("Editor room recovery must run before opening editors");
        for await (const { id, owner, documentKey } of storage.nativeRooms.pending()) {
          await recoverSource(documentKey, async () => {
            await integrate(owner, id);
            if (await storage.nativeRooms.source({ owner, documentKey }))
              await projection.reconcile({ owner, documentKey });
            await storage.nativeRooms.remove({ owner, roomId: id });
          });
        }
        for await (const address of storage.nativeFileProjections.pending())
          await recoverSource(address.documentKey, () => projection.reconcile(address));
      });
    },
    async dispose() {
      closed = true;
      stopProjectionWatch();
      await Promise.allSettled([...pending]);
      await files.drain();
      presence.close();
      for (const room of rooms.values()) for (const close of room.closeWatchers) close();
      rooms.clear();
    },
  };
};
