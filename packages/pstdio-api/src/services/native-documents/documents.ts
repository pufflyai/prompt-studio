import type { NativeDocumentSelection, NativeTextTarget } from "pstdio-api-contracts";
import { NativeDocumentRoomError } from "pstdio-db";
import {
  NativeSourcePendingError,
  NativeSourceRecoveryError,
  NativeSourceRetiredError,
  type StorageOwner,
  StorageRevisionChangedError,
} from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";
import { createNativeFileProjector } from "./file-projection";
import { type loadNativeMarkdownFile, NativeDocumentSourceError, type saveNativeMarkdownFile } from "./file-source";
import { createNativeProjectionQueue } from "./projection-queue";
import { watchNativeProjections } from "./projection-watch";
import { integrateNativeRoom } from "./room-integration";
import { createNativeRoomSnapshot, type Room, type RoomRequest } from "./room-snapshot";
import {
  initializeNativeRoomSource,
  joinNativeRoomSource,
  loadNativeRoomSource,
  type NativeRoomOpenInput,
} from "./room-source";
import { createNativeSessionPresence } from "./session-presence";
import { nativeAdmissionTarget, validateWritableSource } from "./validate-writable-source";

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
  access: Parameters<typeof validateWritableSource>[0];
  save: (input: Parameters<typeof saveNativeMarkdownFile>[1]) => ReturnType<typeof saveNativeMarkdownFile>;
  initialize: (loaded: Awaited<ReturnType<typeof loadNativeMarkdownFile>>) => Promise<void>;
  deviceId: string;
  presenceIdentity: () => Promise<{ label: string; deviceName: string }>;
}) => {
  const storage = deps.storage;
  const projection = createNativeFileProjector(deps);
  const files = createNativeProjectionQueue({
    reconcile: async (address) => {
      await projection.reconcile(address);
      return (await storage.nativeFileProjections.read(address))?.completedRevision ?? 0;
    },
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
  const snapshot = createNativeRoomSnapshot(storage, files);
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
  const release = async (room: Room, roomId: string) => {
    await storage.nativeRooms.remove({ owner: room.owner, roomId });
    presence.closeRoom(roomId);
    for (const close of room.closeWatchers) close();
    rooms.delete(roomId);
  };
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
    resolveSource(input: NativeTextTarget & { projectId: string; signal?: AbortSignal }) {
      return track(async () => {
        const expectedSource = await deps.access(input);
        return projection.read(expectedSource, () => loadNativeRoomSource(deps, { ...input, expectedSource }));
      });
    },
    open(input: NativeRoomOpenInput) {
      return track(async () => {
        const initialize = () => initializeNativeRoomSource(deps, input);
        const joined = await joinNativeRoomSource(deps, input);
        const {
          loaded,
          editable,
          initial: initialized,
        } = joined ??
        (input.expectedSource ? await projection.read(input.expectedSource, initialize) : await initialize());
        const text = canonical(loaded);
        const { id: roomId } = await storage.nativeRooms.create({
          owner: loaded.owner,
          documentKey: loaded.documentKey,
          target: loaded.projectionTarget,
          writable: editable,
          state: input.sourceState ?? (await text.exportUpdate()),
        });
        const room: Room = {
          target: nativeAdmissionTarget(input),
          editable,
          owner: loaded.owner,
          documentKey: loaded.documentKey,
          queue: Promise.resolve(),
          closeWatchers: new Set(),
        };
        if (room.editable && initialized) await projection.initialize(room, initialized);
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
          content: { ...loaded.content, editable },
          ...initial,
        };
      });
    },
    submit(input: RoomRequest & { update: Uint8Array }) {
      return run(input, async (room) => {
        await validateWritableSource(deps.access, room);
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
    project(input: RoomRequest & { revision: number }) {
      return run(input, async (room) => {
        await validateWritableSource(deps.access, room);
        const current = await canonical(room).snapshot();
        if (input.revision > current.revision)
          throw new NativeDocumentRoomError("invalid_frame", "Projection exceeds the durable revision");
        if (((await storage.nativeFileProjections.read(room))?.completedRevision ?? 0) < input.revision)
          await files.through(room, input.revision);
        return { revision: input.revision };
      });
    },
    release(input: RoomRequest) {
      return run(input, async (room) => {
        await integrate(room.owner, input.roomId);
        await release(room, input.roomId);
      });
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
        await release(room, input.roomId);
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
