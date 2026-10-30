import type { StorageOwner } from "../shared";

export interface PresenceAddress {
  owner: StorageOwner;
  resourceId: string;
}
export interface PresenceParticipant<T> {
  deviceId: string;
  participantId: string;
  value: T;
}
export type PresenceChange<T> =
  | { action: "upsert"; participantId: string; value: T }
  | { action: "leave"; participantId: string };
interface Room<T> {
  handles: Set<string>;
  participants: Map<string, { participant: PresenceParticipant<T>; expiresAt: number }>;
  listeners: Set<() => void>;
}
const keyFor = ({ owner, resourceId }: PresenceAddress) =>
  JSON.stringify([owner.workbenchId, owner.extensionId, resourceId]);
const participantKey = (deviceId: string, participantId: string) => JSON.stringify([deviceId, participantId]);
export class PresenceError extends Error {
  constructor(
    readonly code: "not_found" | "room_limit",
    message: string,
  ) {
    super(message);
  }
}

/** Connection-owned live values. Encoding, validation, timers and transport belong to the caller. */
export const createPresenceHub = <T>(input: {
  deviceId: string;
  leaseMs: number;
  maxRooms: number;
  now?: () => number;
  send(address: PresenceAddress, change: PresenceChange<T>): void | Promise<void>;
}) => {
  const now = input.now ?? Date.now;
  const rooms = new Map<string, Room<T>>();
  const notify = (room: Room<T>) => {
    for (const listener of room.listeners) listener();
  };
  const send = (address: PresenceAddress, change: PresenceChange<T>) => {
    // There is no durable outbox. The caller's next heartbeat republishes live state.
    try {
      void Promise.resolve(input.send(address, change)).catch(() => {});
    } catch {}
  };
  const upsert = (room: Room<T>, deviceId: string, change: Extract<PresenceChange<T>, { action: "upsert" }>) => {
    room.participants.set(participantKey(deviceId, change.participantId), {
      participant: { deviceId, participantId: change.participantId, value: change.value },
      expiresAt: now() + input.leaseMs,
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
  const publishLocal = (address: PresenceAddress, room: Room<T>) => {
    for (const { participant, expiresAt } of room.participants.values()) {
      if (participant.deviceId !== input.deviceId || !room.handles.has(participant.participantId) || expiresAt <= now())
        continue;
      send(address, { action: "upsert", participantId: participant.participantId, value: participant.value });
    }
  };
  return {
    open(source: PresenceAddress, createValue: (participantId: string) => T) {
      const address = { owner: { ...source.owner }, resourceId: source.resourceId };
      const key = keyFor(address);
      let room = rooms.get(key);
      if (!room) {
        const prefix = `${JSON.stringify([address.owner.workbenchId]).slice(0, -1)},`;
        if ([...rooms.keys()].filter((key) => key.startsWith(prefix)).length >= input.maxRooms)
          throw new PresenceError("room_limit", "Presence room limit reached");
        room = { handles: new Set(), participants: new Map(), listeners: new Set() };
      }
      const participantId = crypto.randomUUID();
      // Construct and validate the caller's value before admitting a connection.
      const value = createValue(participantId);
      rooms.set(key, room);
      const joined = room;
      joined.handles.add(participantId);
      const initial = { action: "upsert" as const, participantId, value };
      upsert(joined, input.deviceId, initial);
      send(address, initial);
      return {
        participantId,
        update(value: T) {
          if (!joined.handles.has(participantId)) throw new PresenceError("not_found", "Presence connection not found");
          const change = { action: "upsert" as const, participantId, value };
          upsert(joined, input.deviceId, change);
          send(address, change);
        },
        close() {
          if (!joined.handles.delete(participantId)) return;
          joined.participants.delete(participantKey(input.deviceId, participantId));
          notify(joined);
          send(address, { action: "leave", participantId });
          if (!joined.handles.size) {
            joined.participants.clear();
            joined.listeners.clear();
            rooms.delete(key);
          }
        },
      };
    },
    receive(address: PresenceAddress, deviceId: string, change: PresenceChange<T>) {
      if (deviceId === input.deviceId) return;
      const room = rooms.get(keyFor(address));
      if (!room?.handles.size) return;
      if (change.action === "upsert") {
        const joined = !room.participants.has(participantKey(deviceId, change.participantId));
        upsert(room, deviceId, change);
        // Reply once to a new peer; ordinary heartbeats must not echo.
        if (joined) publishLocal(address, room);
      } else if (room.participants.delete(participantKey(deviceId, change.participantId))) notify(room);
    },
    snapshot(address: PresenceAddress) {
      expire();
      return [...(rooms.get(keyFor(address))?.participants.values() ?? [])].map(({ participant }) =>
        structuredClone(participant),
      );
    },
    watch(address: PresenceAddress, changed: () => void) {
      const room = rooms.get(keyFor(address));
      if (!room) throw new PresenceError("not_found", "Presence room not found");
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
        for (const [key, { participant }] of room.participants) {
          if (participant.deviceId === input.deviceId) continue;
          room.participants.delete(key);
          changed = true;
        }
        if (changed) notify(room);
      }
    },
    republish(workbenchId: string) {
      expire();
      for (const [key, room] of rooms) {
        const [project, extensionId, resourceId] = JSON.parse(key) as string[];
        if (project === workbenchId) publishLocal({ owner: { workbenchId, extensionId }, resourceId }, room);
      }
    },
    close() {
      rooms.clear();
    },
  };
};
