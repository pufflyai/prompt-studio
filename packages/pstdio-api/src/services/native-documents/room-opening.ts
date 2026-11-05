import type { StorageOwner } from "pstdio-sync";
import type { createNativeFileProjector } from "./file-projection";
import type { createNativeRoomSnapshot, Room } from "./room-snapshot";
import { initializeNativeRoomSource, joinNativeRoomSource, type NativeRoomOpenInput } from "./room-source";
import { isRecordFieldSource } from "./source-kind";
import { nativeAdmissionTarget } from "./validate-writable-source";

export const createNativeRoomOpener = (deps: {
  source: Parameters<typeof initializeNativeRoomSource>[0];
  projection: ReturnType<typeof createNativeFileProjector>;
  snapshot: ReturnType<typeof createNativeRoomSnapshot>;
  integrate: (owner: StorageOwner, roomId: string) => Promise<number>;
  opened: (room: Room, roomId: string) => void;
}) => {
  const storage = deps.source.storage;
  return async (input: NativeRoomOpenInput) => {
    // Legacy callers supply only the presentation target. Resolve its authority
    // before admitting them to the same source queue used by public sessions.
    const source = input.expectedSource ?? (await deps.source.access(input));
    const request = {
      ...input,
      expectedSource: { owner: source.owner, documentKey: source.documentKey, generation: source.generation },
    };
    const initialize = () => initializeNativeRoomSource(deps.source, request);
    // Public admission already validated the full source. Legacy presentations
    // must still prove their complete bytes inside the projection queue.
    const joined = input.expectedSource ? await joinNativeRoomSource(deps.source, request) : undefined;
    const {
      loaded,
      editable,
      initial: initialized,
    } = joined ?? (await deps.projection.read(request.expectedSource, initialize));
    const text = storage.openNativeTextDocument({ owner: loaded.owner, fileId: loaded.documentKey });
    const { id: roomId } = await storage.nativeRooms.create({
      owner: loaded.owner,
      documentKey: loaded.documentKey,
      target: loaded.projectionTarget,
      writable: editable,
      state: input.sourceState ?? (await text.exportUpdate()),
      generation: loaded.generation,
    });
    const recordField = isRecordFieldSource(loaded.content.documentSource);
    const syncDocument = recordField ? undefined : JSON.stringify(["native-markdown", loaded.documentKey]);
    const room: Room = {
      target: nativeAdmissionTarget(input),
      editable,
      owner: loaded.owner,
      documentKey: loaded.documentKey,
      generation: loaded.generation,
      syncDocument,
      recordField,
      queue: Promise.resolve(),
      closeWatchers: new Set(),
    };
    if (room.editable && !room.recordField && initialized) await deps.projection.initialize(room, initialized);
    if (input.pendingUpdate)
      await storage.nativeRooms.apply({ owner: room.owner, roomId, update: input.pendingUpdate });
    // A reconnect can carry edits from a retired source history. Preserve that history
    // first; recovery can finish integration if the process stops here.
    room.integratedRevision = await deps.integrate(room.owner, roomId);
    const initial = await deps.snapshot(room, roomId);
    deps.opened(room, roomId);
    return {
      roomId,
      owner: room.owner,
      documentKey: room.documentKey,
      content: { ...loaded.content, editable },
      ...initial,
    };
  };
};
