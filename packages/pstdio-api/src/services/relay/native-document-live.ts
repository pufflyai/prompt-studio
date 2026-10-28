import { nativePresenceLimits, nativePresenceLiveSchema } from "pstdio-api-contracts";
import { openLive, type SyncSpace, sealLive } from "pstdio-sync/encryption";
import type { LiveClientMessage, LiveServerMessage } from "pstdio-sync-contracts";
import type { createNativeSessionPresence } from "../native-documents/session-presence";

/** One project live connection carries ephemeral editor state, separately from durable synchronization. */
export const createNativeDocumentLive = (input: {
  projectId: string;
  deviceId: string;
  live: ReturnType<typeof createNativeSessionPresence>["live"];
  send: (message: LiveClientMessage) => boolean;
}) => {
  let active: { space: SyncSpace; controller: AbortController } | undefined;
  let closed = false;
  let receiving = Promise.resolve();
  let sending = Promise.resolve();
  const stop = input.live.subscribe(input.projectId, (frame) => {
    const current = active;
    if (!current || closed) return;
    const work = sending.then(async () => {
      if (current.controller.signal.aborted) return;
      const message = await sealLive(current.space, input.deviceId, new TextEncoder().encode(JSON.stringify(frame)));
      if (!current.controller.signal.aborted) input.send(message);
    });
    sending = work.catch(() => {});
    return work;
  });
  const receive = async (message: Extract<LiveServerMessage, { type: "live" }>, current: typeof active) => {
    if (!current || closed || message.spaceOwner !== null) return false;
    // Bound the base64 ciphertext before decrypting. A 4KiB frame plus its envelope fits under 8KiB.
    if (message.payload.length > nativePresenceLimits.bytes * 2) return false;
    let bytes: Uint8Array;
    try {
      bytes = await openLive(current.space, message);
    } catch {
      return false;
    }
    if (current.controller.signal.aborted || bytes.byteLength > nativePresenceLimits.bytes) return false;
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return false;
    }
    const parsed = nativePresenceLiveSchema.safeParse(value);
    if (!parsed.success) return false;
    input.live.receive(input.projectId, message.deviceId, parsed.data);
    return true;
  };
  const renewAccess = () => {
    const space = active?.space;
    active?.controller.abort();
    active = space ? { space, controller: new AbortController() } : undefined;
  };
  const clearSpace = () => {
    active?.controller.abort();
    active = undefined;
    input.live.disconnected(input.projectId);
  };
  return {
    setSpace(next: SyncSpace) {
      if (next.projectId !== input.projectId || next.spaceOwner !== null)
        throw new Error("Wrong editor presence space");
      if (closed) return;
      if (active?.space.generation === next.generation) {
        active.space = next;
        return;
      }
      active?.controller.abort();
      active = { space: next, controller: new AbortController() };
      input.live.republish(input.projectId);
    },
    renewAccess,
    republish() {
      if (active && !closed) input.live.republish(input.projectId);
    },
    clearSpace,
    receive(message: Extract<LiveServerMessage, { type: "live" }>) {
      // Preserve socket order across asynchronous decryption, including leave after an update.
      const current = active;
      const result = receiving.then(() => receive(message, current));
      receiving = result.then(
        () => {},
        () => {},
      );
      return result;
    },
    async close() {
      closed = true;
      clearSpace();
      stop();
      await Promise.all([receiving, sending]);
    },
  };
};
