import { type NativeDocumentSelection, type NativePresenceLive, nativePresenceLimits } from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import { createNativePresence, NativePresenceError } from "./presence";

interface Address {
  owner: StorageOwner;
  documentKey: string;
}

export const createNativeSessionPresence = (input: {
  deviceId: string;
  identity: () => Promise<{ label: string; deviceName: string }>;
}) => {
  const listeners = new Map<string, Set<(frame: NativePresenceLive) => void | Promise<void>>>();
  const connections = new Map<string, Map<string, ReturnType<typeof hub.open>>>();
  const hub = createNativePresence({
    deviceId: input.deviceId,
    send: async (owner, frame) => {
      await Promise.allSettled([...(listeners.get(owner.workbenchId) ?? [])].map((publish) => publish(frame)));
    },
  });
  const timer = setInterval(hub.expire, nativePresenceLimits.heartbeatMs);
  timer.unref?.();
  const closeRoom = (roomId: string) => {
    for (const connection of connections.get(roomId)?.values() ?? []) connection.close();
    connections.delete(roomId);
  };
  return {
    async join(address: Address, request: { roomId: string; seedId: string }) {
      const identity = await input.identity();
      const connection = hub.open({ ...address, ...request, ...identity });
      let joined = connections.get(request.roomId);
      if (!joined) {
        joined = new Map();
        connections.set(request.roomId, joined);
      }
      joined.set(connection.participantId, connection);
      return {
        participantId: connection.participantId,
        snapshot: () => hub.snapshot(address),
        watch: (changed: () => void) => hub.watch(address, changed),
        close: () => {
          connection.close();
          joined.delete(connection.participantId);
          if (!joined.size) connections.delete(request.roomId);
        },
      };
    },
    update(request: { roomId: string; participantId: string; seedId: string; selection: NativeDocumentSelection }) {
      const connection = connections.get(request.roomId)?.get(request.participantId);
      if (!connection) throw new NativePresenceError("not_found", "Native presence connection not found");
      connection.update(request);
    },
    closeRoom,
    live: {
      subscribe(workbenchId: string, publish: (frame: NativePresenceLive) => void | Promise<void>) {
        let active = listeners.get(workbenchId);
        if (!active) {
          active = new Set();
          listeners.set(workbenchId, active);
        }
        active.add(publish);
        return () => {
          active.delete(publish);
          if (!active.size) listeners.delete(workbenchId);
        };
      },
      receive: hub.receive,
      republish: hub.republish,
      disconnected: hub.forgetRemote,
    },
    close() {
      clearInterval(timer);
      for (const roomId of connections.keys()) closeRoom(roomId);
      hub.close();
      listeners.clear();
    },
  };
};
