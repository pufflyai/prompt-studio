import { diffChars } from "diff";
import * as Y from "yjs";

type ChangeOrigin = "remote" | "history" | "composition" | "edit";
/** A rendering replica keeps composition edits based on the source the person still sees. */
export const createMarkdownTextDocument = (shared: Y.Doc, beforeRemote?: () => void, sharedOrigin?: object) => {
  const replica = new Y.Doc({ gc: false });
  Y.applyUpdate(replica, Y.encodeStateAsUpdate(shared));
  const text = replica.getText("content");
  const localOrigin = Symbol("markdown-editor");
  const remoteOrigin = Symbol("markdown-remote");
  const history = new Y.UndoManager(text, { trackedOrigins: new Set([localOrigin]) });
  const listeners = new Set<(source: string, origin: ChangeOrigin) => void>();
  let composition: Y.Doc | undefined;
  let rendered = text.toString();
  const deliver = (source: string, origin: ChangeOrigin) => {
    rendered = source;
    for (const listener of listeners) listener(source, origin);
  };
  const publish = (origin: ChangeOrigin) => {
    const source = text.toString();
    if (source === rendered && origin === "remote") return;
    deliver(source, origin);
  };
  const applyRemote = () => {
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(shared, Y.encodeStateVector(replica)), remoteOrigin);
  };
  const receive = (_update?: Uint8Array, origin?: unknown) => {
    if (composition || origin === localOrigin) return;
    // Pending editor changes still belong to the rendered replica's causal history.
    beforeRemote?.();
    applyRemote();
    publish("remote");
  };
  const send = (update: Uint8Array, origin: unknown) => {
    if (origin !== localOrigin && origin !== history) return;
    // The public session origin also belongs to other local callers. Own forwarding is already rendered.
    rendered = text.toString();
    Y.applyUpdate(shared, update, sharedOrigin ?? localOrigin);
    if (origin === history) publish("history");
  };
  shared.on("update", receive);
  replica.on("update", send);
  return {
    get text() {
      return (composition ?? replica).getText("content");
    },
    write(source: string) {
      const document = composition ?? replica;
      const target = document.getText("content");
      const changes = diffChars(target.toString(), source);
      document.transact(() => {
        let index = 0;
        for (const change of changes) {
          if (change.removed) target.delete(index, change.value.length);
          else {
            if (change.added) target.insert(index, change.value);
            index += change.value.length;
          }
        }
      }, localOrigin);
      rendered = target.toString();
      return !composition;
    },
    applyLocalUpdate(update: Uint8Array) {
      const document = composition ?? replica;
      const before = document.getText("content").toString();
      history.stopCapturing();
      Y.applyUpdate(document, update, localOrigin);
      history.stopCapturing();
      if (!composition && before !== text.toString()) publish("edit");
    },
    setComposing(value: boolean) {
      if (Boolean(composition) === value) return;
      history.stopCapturing();
      if (value) {
        composition = new Y.Doc({ gc: false });
        Y.applyUpdate(composition, Y.encodeStateAsUpdate(replica));
        return;
      }
      const committed = composition!;
      composition = undefined;
      if (committed.getText("content").toString() === text.toString()) {
        committed.destroy();
        applyRemote();
        deliver(text.toString(), "remote");
        return;
      }
      // A single transaction owns the composition regardless of its time spent in the IME.
      try {
        Y.applyUpdate(replica, Y.encodeStateAsUpdate(committed, Y.encodeStateVector(replica)), localOrigin);
      } finally {
        committed.destroy();
      }
      history.stopCapturing();
      applyRemote();
      publish("composition");
    },
    subscribe(listener: (source: string, origin: ChangeOrigin) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    undo() {
      if (!composition) history.undo();
    },
    redo() {
      if (!composition) history.redo();
    },
    destroy() {
      shared.off("update", receive);
      replica.off("update", send);
      listeners.clear();
      history.destroy();
      composition?.destroy();
      replica.destroy();
    },
  };
};
