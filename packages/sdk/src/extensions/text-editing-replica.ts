import { createTextReplica, type TextReplicaSnapshot } from "pstdio-sync/text";
import * as Y from "yjs";
import { textEditingFailure } from "./text-editing-codec";
import type { TextEditingReceiveContext } from "./text-editing-types";

export const createTextReceiveHandlers = () => {
  const handlers = new Set<(context?: TextEditingReceiveContext) => void>();
  let receiving = false;
  return {
    add(handler: (context?: TextEditingReceiveContext) => void) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    run(context?: TextEditingReceiveContext | (() => TextEditingReceiveContext)) {
      if (receiving) throw textEditingFailure("source_unavailable", "A renderer cannot receive text recursively", true);
      if (!handlers.size) return;
      receiving = true;
      try {
        const incoming = typeof context === "function" ? context() : context;
        for (const handler of handlers) {
          const result: unknown = handler(incoming);
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

const changesText = (document: Y.Doc, snapshot: TextReplicaSnapshot) => {
  const probe = new Y.Doc({ gc: false });
  try {
    Y.applyUpdate(probe, Y.encodeStateAsUpdate(document));
    let changed = false;
    probe.getText("content").observe(() => {
      changed = true;
    });
    Y.applyUpdate(probe, snapshot.state);
    return changed;
  } finally {
    probe.destroy();
  }
};

/** All callbacks retain their ingress barrier; metadata distinguishes pure receipts from incoming edits. */
export const createTextEditingReplica = (
  initial: TextReplicaSnapshot & { editable: boolean },
  beforeReceive: (context: () => TextEditingReceiveContext) => void,
  editable: () => boolean,
) => {
  const replica = createTextReplica(initial);
  const before = (snapshot: typeof initial) => {
    const historyChanged = snapshot.seedId !== initial.seedId;
    beforeReceive(() => ({
      historyChanged,
      editableChanged: snapshot.editable !== editable(),
      textChanged: historyChanged || changesText(replica.document, snapshot),
    }));
  };
  return {
    ...replica,
    receive(snapshot: typeof initial) {
      before(snapshot);
      return replica.receive(snapshot);
    },
    acknowledge(count: number, snapshot: typeof initial) {
      before(snapshot);
      return replica.acknowledge(count, snapshot);
    },
  };
};
