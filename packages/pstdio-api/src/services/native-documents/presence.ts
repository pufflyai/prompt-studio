import {
  type NativeDocumentSelection,
  type NativeParticipant,
  type NativePresenceLive,
  nativePresenceLimits,
  nativePresenceLiveSchema,
} from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";

interface Address {
  owner: StorageOwner;
  documentKey: string;
}
interface Room {
  handles: Set<string>;
  participants: Map<string, { value: NativeParticipant; expiresAt: number }>;
  listeners: Set<() => void>;
}
interface Connection extends Address {
  roomId: string;
  seedId: string;
  label: string;
  deviceName: string;
}
const keyFor = ({ owner, documentKey }: Address) => JSON.stringify([owner.workbenchId, owner.extensionId, documentKey]);
const participantKey = (deviceId: string, participantId: string) => JSON.stringify([deviceId, participantId]);
export class NativePresenceError extends Error {
  constructor(
    readonly code: "not_found" | "room_limit",
    message: string,
  ) {
    super(message);
  }
}

/** Connection-owned live state. No database, files, recovery journal or durable document dependencies. */
export const createNativePresence = (input: {
  deviceId: string;
  now?: () => number;
  send: (owner: StorageOwner, frame: NativePresenceLive) => void | Promise<void>;
}) => {
  const now = input.now ?? Date.now;
  const rooms = new Map<string, Room>();
  const notify = (room: Room) => {
    for (const listener of room.listeners) listener();
  };
  const send = (owner: StorageOwner, frame: NativePresenceLive) => {
    // Live traffic has no outbox. The next client heartbeat republishes it after reconnect.
    try {
      void Promise.resolve(input.send(owner, frame)).catch(() => {});
    } catch {}
  };
  const upsert = (room: Room, deviceId: string, frame: Extract<NativePresenceLive, { action: "upsert" }>) => {
    room.participants.set(participantKey(deviceId, frame.participantId), {
      value: { ...frame, deviceId },
      expiresAt: now() + nativePresenceLimits.leaseMs,
    });
    notify(room);
  };
  const expire = () => {
    for (const room of rooms.values()) {
      let changed = false;
      for (const [key, participant] of room.participants) {
        if (participant.expiresAt > now()) continue;
        room.participants.delete(key);
        changed = true;
      }
      if (changed) notify(room);
    }
  };
  const publishLocal = (owner: StorageOwner, room: Room) => {
    for (const { value, expiresAt } of room.participants.values()) {
      if (value.deviceId !== input.deviceId || !room.handles.has(value.participantId) || expiresAt <= now()) continue;
      const { deviceId: _deviceId, ...frame } = value;
      send(owner, frame);
    }
  };
  return {
    open(connection: Connection) {
      const address = { owner: { ...connection.owner }, documentKey: connection.documentKey };
      const key = keyFor(address);
      let room = rooms.get(key);
      if (!room) {
        const prefix = JSON.stringify([address.owner.workbenchId]).slice(0, -1);
        const count = [...rooms.keys()].filter((key) => key.startsWith(`${prefix},`)).length;
        if (count >= nativePresenceLimits.rooms)
          throw new NativePresenceError("room_limit", "Native presence room limit reached");
        room = { handles: new Set(), participants: new Map(), listeners: new Set() };
      }
      const participantId = crypto.randomUUID();
      const initial = nativePresenceLiveSchema.parse({
        kind: "native-document-presence",
        version: 1,
        action: "upsert",
        extensionId: address.owner.extensionId,
        documentKey: address.documentKey,
        participantId,
        seedId: connection.seedId,
        label: connection.label,
        deviceName: connection.deviceName,
        selection: null,
      });
      if (initial.action !== "upsert") throw new Error("Invalid native presence join");
      rooms.set(key, room);
      const joined = room;
      joined.handles.add(participantId);
      upsert(joined, input.deviceId, initial);
      send(address.owner, initial);
      return {
        participantId,
        update(update: { roomId: string; seedId: string; selection: NativeDocumentSelection }) {
          if (!joined.handles.has(participantId) || update.roomId !== connection.roomId)
            throw new NativePresenceError("not_found", "Native presence connection not found");
          const frame = nativePresenceLiveSchema.parse({
            ...initial,
            seedId: update.seedId,
            selection: update.selection,
          });
          if (frame.action !== "upsert") throw new Error("Invalid native presence update");
          upsert(joined, input.deviceId, frame);
          send(address.owner, frame);
        },
        close() {
          if (!joined.handles.delete(participantId)) return;
          joined.participants.delete(participantKey(input.deviceId, participantId));
          notify(joined);
          send(address.owner, {
            kind: "native-document-presence",
            version: 1,
            action: "leave",
            extensionId: address.owner.extensionId,
            documentKey: address.documentKey,
            participantId,
          });
          if (!joined.handles.size) {
            joined.participants.clear();
            joined.listeners.clear();
            rooms.delete(key);
          }
        },
      };
    },
    receive(workbenchId: string, deviceId: string, value: unknown) {
      const frame = nativePresenceLiveSchema.parse(value);
      if (deviceId === input.deviceId) return;
      const room = rooms.get(
        keyFor({ owner: { workbenchId, extensionId: frame.extensionId }, documentKey: frame.documentKey }),
      );
      if (!room?.handles.size) return;
      if (frame.action === "upsert") {
        const joined = !room.participants.has(participantKey(deviceId, frame.participantId));
        upsert(room, deviceId, frame);
        // Reply only to a newly observed peer; ordinary heartbeats must not echo.
        if (joined) publishLocal({ workbenchId, extensionId: frame.extensionId }, room);
      } else if (room.participants.delete(participantKey(deviceId, frame.participantId))) notify(room);
    },
    snapshot(address: Address) {
      expire();
      return [...(rooms.get(keyFor(address))?.participants.values() ?? [])].map(({ value }) => structuredClone(value));
    },
    watch(address: Address, changed: () => void) {
      const room = rooms.get(keyFor(address));
      if (!room) throw new NativePresenceError("not_found", "Native presence room not found");
      room.listeners.add(changed);
      return () => {
        room.listeners.delete(changed);
      };
    },
    expire,
    forgetRemote(workbenchId: string) {
      for (const [key, room] of rooms) {
        if ((JSON.parse(key) as string[])[0] !== workbenchId) continue;
        let changed = false;
        for (const [participant, { value }] of room.participants) {
          if (value.deviceId === input.deviceId) continue;
          room.participants.delete(participant);
          changed = true;
        }
        if (changed) notify(room);
      }
    },
    republish(workbenchId: string) {
      expire();
      for (const [key, room] of rooms) {
        if ((JSON.parse(key) as string[])[0] !== workbenchId) continue;
        publishLocal({ workbenchId, extensionId: (JSON.parse(key) as string[])[1]! }, room);
      }
    },
    close() {
      rooms.clear();
    },
  };
};
