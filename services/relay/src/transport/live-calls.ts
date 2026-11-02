import type { LiveClientMessage, LiveServerMessage } from "pstdio-sync-contracts";

export interface CallConnection {
  deviceId: string;
  accountId: string;
  projectKey: string;
  registrations: Set<string>;
  send(message: LiveServerMessage): void;
}
export const liveKey = (spaceOwner: string | null, name: string) => JSON.stringify([spaceOwner, name]);

/** Only routing metadata lives here; caller IDs are local to their connection. */
export const createLiveCalls = (maximum: number, connections: (project: string) => Iterable<CallConnection>) => {
  const pending = new Map<string, { caller: CallConnection; callee: CallConnection; id: string }>();
  const finish = (key: string, error: "cancelled" | "disconnected") => {
    const call = pending.get(key);
    if (!call) return;
    pending.delete(key);
    call.caller.send({ type: "call-error", id: call.id, error });
    call.callee.send({ type: "cancelled", id: key });
  };
  const start = (connection: CallConnection, message: Extract<LiveClientMessage, { type: "call" }>) => {
    if ([...pending.values()].some((call) => call.caller === connection && call.id === message.id)) return false;
    const callee = [...connections(connection.projectKey)].find(
      (candidate) =>
        candidate.deviceId === message.deviceId &&
        (message.spaceOwner === null || candidate.accountId === message.spaceOwner) &&
        candidate.registrations.has(liveKey(message.spaceOwner, message.procedure)),
    );
    if (!callee) {
      connection.send({ type: "call-error", id: message.id, error: "unavailable" });
      return true;
    }
    const count = (target: CallConnection) =>
      [...pending.values()].filter((call) => call.caller === target || call.callee === target).length;
    if (count(connection) >= maximum || count(callee) >= maximum) {
      connection.send({ type: "call-error", id: message.id, error: "limit-exceeded" });
      return true;
    }
    const key = crypto.randomUUID();
    pending.set(key, { caller: connection, callee, id: message.id });
    callee.send({ ...message, type: "invocation", id: key, deviceId: connection.deviceId });
    return true;
  };
  const reply = (
    connection: CallConnection,
    message: Extract<LiveClientMessage, { type: "result" | "call-error" }>,
  ) => {
    const call = pending.get(message.id);
    // Late replies after cancellation are harmless, and cannot reach a new call.
    if (!call) return true;
    if (call.callee !== connection) return false;
    if (message.type === "call-error" || message.done) pending.delete(message.id);
    call.caller.send(
      message.type === "result"
        ? { ...message, id: call.id, deviceId: connection.deviceId }
        : { ...message, id: call.id },
    );
    return true;
  };
  return {
    close(connection: CallConnection) {
      for (const [key, call] of pending)
        if (call.caller === connection || call.callee === connection) finish(key, "disconnected");
    },
    message(connection: CallConnection, message: LiveClientMessage) {
      if (message.type === "call") return start(connection, message);
      if (message.type === "cancel") {
        for (const [key, call] of pending)
          if (call.caller === connection && call.id === message.id) finish(key, "cancelled");
        return true;
      }
      if (message.type === "result" || message.type === "call-error") return reply(connection, message);
      return false;
    },
  };
};
