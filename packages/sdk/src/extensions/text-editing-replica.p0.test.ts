import { expect, test } from "bun:test";
import * as Y from "yjs";
import { createTextEditingReplica, createTextReceiveHandlers } from "./text-editing-replica";
import type { TextEditingReceiveContext } from "./text-editing-types";

const fixture = () => {
  const host = new Y.Doc({ gc: false });
  host.getText("content").insert(0, "source");
  const snapshot = (seedId = "initial", editable = true) => ({
    state: Y.encodeStateAsUpdate(host),
    seedId,
    sourceSeedId: seedId,
    editable,
  });
  const contexts: TextEditingReceiveContext[] = [];
  const replica = createTextEditingReplica(
    snapshot(),
    (context) => contexts.push(context()),
    () => true,
  );
  return {
    host,
    snapshot,
    contexts,
    replica,
    dispose() {
      replica.dispose();
      host.destroy();
    },
  };
};

test("own acknowledgements still invoke callbacks without requesting a text drain for host metadata", () => {
  const f = fixture();
  try {
    f.replica.document.getText("content").insert(0, "local ");
    const frame = f.replica.capture();
    Y.applyUpdate(f.host, frame.update!);
    f.host.getMap("authors").set("writer", "local");
    f.replica.acknowledge(frame.count, f.snapshot());
    expect(f.contexts).toEqual([{ textChanged: false, historyChanged: false, editableChanged: false }]);
    expect(f.replica.pending()).toBe(false);
  } finally {
    f.dispose();
  }
});

test.each([
  "insert",
  "delete",
  "replace",
])("incoming %s keeps the renderer barrier, including unchanged text identities", (operation) => {
  const f = fixture();
  try {
    const before = Y.encodeStateVector(f.host);
    f.host.transact(() => {
      const text = f.host.getText("content");
      if (operation !== "insert") text.delete(0, 1);
      if (operation !== "delete") text.insert(0, operation === "replace" ? "s" : "peer ");
    });
    if (operation === "delete") expect(Y.encodeStateVector(f.host)).toEqual(before);
    if (operation === "replace") expect(f.host.getText("content").toString()).toBe("source");
    f.replica.receive(f.snapshot());
    expect(f.contexts).toEqual([{ textChanged: true, historyChanged: false, editableChanged: false }]);
  } finally {
    f.dispose();
  }
});

test("a durable acknowledgement can carry foreign text changes", () => {
  const f = fixture();
  try {
    f.replica.document.getText("content").insert(0, "local ");
    const frame = f.replica.capture();
    Y.applyUpdate(f.host, frame.update!);
    f.host.getText("content").insert(0, "peer ");
    f.replica.acknowledge(frame.count, f.snapshot());
    expect(f.contexts[0]?.textChanged).toBe(true);
    expect(f.replica.document.getText("content").toString()).toBe("peer local source");
  } finally {
    f.dispose();
  }
});

test("history and permission transitions keep barriers even without new visible text", () => {
  const f = fixture();
  try {
    f.replica.receive(f.snapshot("initial", false));
    expect(f.contexts[0]).toEqual({ textChanged: false, historyChanged: false, editableChanged: true });
    f.replica.receive(f.snapshot("replacement"));
    expect(f.contexts[1]?.historyChanged).toBe(true);
    expect(f.contexts[1]?.textChanged).toBe(true);
  } finally {
    f.dispose();
  }
});

test("a refused receive leaves the live document untouched and can be received again", () => {
  const host = new Y.Doc({ gc: false });
  host.getText("content").insert(0, "source");
  const snapshot = () => ({ state: Y.encodeStateAsUpdate(host), seedId: "one", sourceSeedId: "one", editable: true });
  let refuse = true;
  const replica = createTextEditingReplica(
    snapshot(),
    () => {
      if (refuse) throw new Error("drain refused");
    },
    () => true,
  );
  try {
    host.getText("content").insert(0, "peer ");
    expect(() => replica.receive(snapshot())).toThrow("drain refused");
    expect(replica.document.getText("content").toString()).toBe("source");
    refuse = false;
    replica.receive(snapshot());
    expect(replica.document.getText("content").toString()).toBe("peer source");
  } finally {
    replica.dispose();
    host.destroy();
  }
});

test("receive metadata is computed once for active handlers and not computed after they unsubscribe", () => {
  const handlers = createTextReceiveHandlers();
  const context = { textChanged: false, historyChanged: false, editableChanged: false };
  let computations = 0;
  const received: unknown[] = [];
  const read = () => {
    computations++;
    return context;
  };
  handlers.run(read);
  expect(computations).toBe(0);
  const first = handlers.add((value) => received.push(value));
  const second = handlers.add((value) => received.push(value));
  handlers.run(read);
  expect(computations).toBe(1);
  expect(received).toEqual([context, context]);
  first();
  second();
  handlers.run(read);
  expect(computations).toBe(1);
});
