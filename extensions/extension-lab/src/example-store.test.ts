import { expect, test } from "bun:test";
import { applyEditingChanges, type GuestHost, type WebviewEditingChange } from "@pstdio/sdk/extensions";
import { createExampleStore } from "./example-store";

const connect = async () => {
  const initial = { frame: 42, playing: false, object: { x: 0 } };
  const store = createExampleStore("kiln", initial);
  const listeners = new Map<string, (payload: unknown) => void>();
  const writes: WebviewEditingChange[][] = [];
  let id = "";
  let snapshot = { value: initial, version: 0, revision: 0, savedRevision: 0 };
  const publish = (appliedSequence?: number) =>
    listeners.get("editing.session")?.({ sessionId: id, snapshot, appliedSequence });
  const host = {
    extensionId: "pstdio.extension-lab",
    onEvent(scope: string, listener: (payload: unknown) => void) {
      listeners.set(scope, listener);
      return () => {
        listeners.delete(scope);
      };
    },
    async call(method: string, input: unknown) {
      if (method === "commands.execute") return { outcome: { ok: true, value: { name: "kiln", state: initial } } };
      const request = input as {
        operation: string;
        sessionId: string;
        sequence: number;
        changes: WebviewEditingChange[];
      };
      if (request.operation === "open") id = request.sessionId;
      if (request.operation === "commit") {
        writes.push(request.changes);
        snapshot = {
          value: applyEditingChanges(snapshot.value, request.changes),
          version: snapshot.version + 1,
          revision: snapshot.revision + 1,
          savedRevision: snapshot.revision + 1,
        };
        publish(request.sequence);
      }
      return snapshot;
    },
  } as GuestHost;
  let disconnect = () => {};
  await new Promise<void>((resolve, reject) => {
    disconnect = store.connect(host, reject, resolve);
  });
  return {
    store,
    writes,
    disconnect,
    remote(value: typeof initial) {
      snapshot = { ...snapshot, value, version: snapshot.version + 1 };
      publish();
    },
  };
};

test("view-only playback survives shared snapshots and stays out of unrelated saves", async () => {
  const editor = await connect();
  editor.store.setTransient({ frame: 99 });
  editor.remote({ frame: 42, playing: true, object: { x: 12 } });
  expect(editor.store.getState()).toEqual({ frame: 99, playing: true, object: { x: 12 } });
  editor.remote({ frame: 1, playing: true, object: { x: 12 } });
  expect(editor.store.getState().frame).toBe(1);
  editor.store.setTransient({ frame: 99 });
  await editor.store.setState({ playing: false });
  expect(editor.writes).toEqual([[{ path: ["playing"], value: false }]]);
  expect(editor.store.getState().frame).toBe(99);
  await editor.store.setState({ frame: 99 });
  expect(editor.writes.at(-1)).toEqual([{ path: ["frame"], value: 99 }]);
  editor.remote({ frame: 30, playing: false, object: { x: 24 } });
  expect(editor.store.getState().frame).toBe(30);
  editor.disconnect();
});

test("removing a shared root field does not save unrelated local playback", async () => {
  const editor = await connect();
  editor.store.setTransient({ frame: 99 });
  await editor.store.setState((state) => {
    const { object: _removed, ...next } = state;
    return next as typeof state;
  });
  expect(editor.writes).toEqual([[{ path: [], value: { frame: 42, playing: false } }]]);
  expect(editor.store.getState().frame).toBe(99);
  editor.disconnect();
});
