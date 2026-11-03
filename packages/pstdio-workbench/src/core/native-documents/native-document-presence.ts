import type { NativeDocumentJoined, NativeDocumentsClient } from "@pstdio/sdk/client";
import {
  type NativeDocumentSelection,
  type NativeParticipant,
  type NativePresenceSnapshot,
  nativePresenceLimits,
} from "pstdio-api-contracts";

type Room = Pick<NativeDocumentJoined, "roomId" | "documentKey" | "sourceSeedId">;
interface Connection {
  room: Room;
  signal: AbortSignal;
  participantId?: string;
  stop: () => void;
}
export interface NativeEditorSelection {
  anchor: Uint8Array;
  focus: Uint8Array;
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** Browser selection state follows its stream connection and is never part of the text outbox. */
export const createNativeDocumentPresence = (input: {
  projectId: string;
  client: NativeDocumentsClient;
  changed: (participants: NativeParticipant[]) => void;
}) => {
  let current: Connection | undefined;
  let selection: NativeDocumentSelection = null;
  let selectionSeed: string | undefined;
  let dirty = false;
  let sending: Promise<void> | undefined;
  let disposed = false;
  const drive = () => {
    if (sending) return sending;
    const active = current;
    if (!active?.participantId || active.signal.aborted || disposed) return Promise.resolve();
    sending = Promise.resolve()
      .then(async () => {
        while (dirty && current === active && !active.signal.aborted) {
          dirty = false;
          await input.client.presence({
            projectId: input.projectId,
            roomId: active.room.roomId,
            documentKey: active.room.documentKey,
            participantId: active.participantId!,
            seedId: active.room.sourceSeedId,
            selection,
            signal: active.signal,
          });
        }
      })
      .catch(() => {
        if (current === active && !active.signal.aborted) input.changed([]);
      })
      .finally(() => {
        sending = undefined;
        if (dirty && current !== active) void drive();
      });
    return sending;
  };
  const disconnect = () => {
    current?.stop();
    current = undefined;
    dirty = false;
    input.changed([]);
  };
  return {
    start(room: Room, signal: AbortSignal) {
      disconnect();
      if (selectionSeed !== room.sourceSeedId) selection = null;
      selectionSeed = room.sourceSeedId;
      const timer = setInterval(() => {
        dirty = true;
        void drive();
      }, nativePresenceLimits.heartbeatMs);
      const onAbort = () => {
        if (current === active) disconnect();
      };
      const active: Connection = {
        room,
        signal,
        stop: () => {
          clearInterval(timer);
          signal.removeEventListener("abort", onAbort);
        },
      };
      current = active;
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) disconnect();
    },
    receive(room: Room, snapshot: NativePresenceSnapshot) {
      const active = current;
      if (!active || active.room !== room || active.signal.aborted) return;
      const joined = active.participantId !== snapshot.participantId;
      active.participantId = snapshot.participantId;
      input.changed(
        snapshot.participants
          .filter((participant) => participant.participantId !== snapshot.participantId)
          .map((participant) => ({
            ...participant,
            selection: participant.seedId === room.sourceSeedId ? participant.selection : null,
          })),
      );
      if (joined) {
        dirty = true;
        void drive();
      }
    },
    setSelection(next: NativeEditorSelection | null) {
      const value = next ? { anchor: encode(next.anchor), head: encode(next.focus) } : null;
      if (selection?.anchor === value?.anchor && selection?.head === value?.head) return sending ?? Promise.resolve();
      selection = value;
      selectionSeed = current?.room.sourceSeedId;
      dirty = true;
      return drive();
    },
    disconnect,
    close() {
      disposed = true;
      disconnect();
    },
  };
};
