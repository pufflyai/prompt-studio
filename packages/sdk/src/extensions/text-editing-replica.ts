import { createTextReplica, type TextReplicaSnapshot } from "pstdio-sync/text";
import { textEditingFailure } from "./text-editing-codec";

export const createTextReceiveHandlers = () => {
  const handlers = new Set<() => void>();
  let receiving = false;
  return {
    add(handler: () => void) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    run() {
      if (receiving) throw textEditingFailure("source_unavailable", "A renderer cannot receive text recursively", true);
      receiving = true;
      try {
        for (const handler of handlers) {
          const result: unknown = handler();
          if (result && typeof result === "object" && "then" in result) {
            void Promise.resolve(result).catch(() => {});
            throw textEditingFailure("source_unavailable", "Text receive handlers must finish synchronously", true);
          }
        }
      } finally {
        receiving = false;
      }
    },
    clear: () => handlers.clear(),
  };
};

/** Every snapshot ingress, including durable receipts, first drains queued renderer edits. */
export const createTextEditingReplica = (initial: TextReplicaSnapshot, beforeReceive: () => void) => {
  const replica = createTextReplica(initial);
  return {
    ...replica,
    receive(snapshot: TextReplicaSnapshot) {
      beforeReceive();
      return replica.receive(snapshot);
    },
    acknowledge(count: number, snapshot: TextReplicaSnapshot) {
      beforeReceive();
      return replica.acknowledge(count, snapshot);
    },
  };
};
