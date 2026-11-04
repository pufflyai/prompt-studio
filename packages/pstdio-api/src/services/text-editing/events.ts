import type { TextEditingError, TextEditingEvent } from "pstdio-api-contracts/extension-kernel";
import { textFailure } from "./errors";
import type { TextConnection, TextMember } from "./types";
/** Full states can replace one another; failure occurrences and distinct close barriers cannot. */
export const textEventBufferKey = (event: TextEditingEvent) => {
  if (event.type === "snapshot" || event.type === "presence") return JSON.stringify([event.memberId, event.type]);
  if (event.type === "prepareClose") return JSON.stringify([event.type, event.barrierId]);
  return Symbol();
};
export const emitTextEvent = (connection: Pick<TextConnection, "listeners" | "buffered">, event: TextEditingEvent) => {
  if (connection.listeners.size) {
    for (const listener of connection.listeners) listener(event);
    return;
  }
  const key = textEventBufferKey(event);
  connection.buffered.delete(key);
  connection.buffered.set(key, event);
};
export const prepareTextClose = (connection: TextConnection) => {
  if (connection.barrier) return connection.barrier.work;
  const deferred = Promise.withResolvers<void>();
  connection.barrier = {
    id: crypto.randomUUID(),
    waiting: new Set(connection.members.values()),
    work: deferred.promise,
    resolve: () => deferred.resolve(),
    reject: deferred.reject,
  };
  emitTextEvent(connection, { type: "prepareClose", barrierId: connection.barrier.id });
  if (!connection.barrier.waiting.size) connection.barrier.resolve();
  return connection.barrier.work;
};
export const failTextClose = (connection: TextConnection, error: TextEditingError) => {
  const barrier = connection.barrier;
  if (!barrier) return;
  connection.barrier = undefined;
  connection.buffered.delete(textEventBufferKey({ type: "prepareClose", barrierId: barrier.id }));
  for (const member of connection.members.values()) {
    member.ready = undefined;
    emitTextEvent(connection, {
      type: "error",
      memberId: member.id,
      handle: member.handle,
      barrierId: barrier.id,
      error,
    });
  }
  barrier.reject(textFailure(error.code, error.message, error.retryable, barrier.id));
};
export const readyTextClose = async (connection: TextConnection, member: TextMember, barrierId: string) => {
  if (connection.barrier?.id !== barrierId)
    throw textFailure("grant_invalid", "This close barrier belongs to another placement generation");
  await member.queue;
  if (connection.barrier?.id !== barrierId) throw textFailure("grant_invalid", "The close barrier has been cancelled");
  member.ready = barrierId;
  connection.barrier.waiting.delete(member);
  if (!connection.barrier.waiting.size) connection.barrier.resolve();
};
