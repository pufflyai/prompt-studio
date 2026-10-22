import { expect, test } from "bun:test";
import * as Y from "yjs";
import { runBinaryTask } from "./binary-background";

const empty = new Uint8Array([0, 0]);

test("background staging excludes invalid updates and preserves healthy edits on both sides", async () => {
  const document = new Y.Doc();
  const updates: Uint8Array[] = [];
  document.on("update", (update: Uint8Array) => updates.push(update));
  document.getMap("values").set("one", 1);
  document.getMap("values").set("two", 2);
  const staged = await runBinaryTask({
    kind: "stage",
    base: empty,
    updates: [updates[0], new Uint8Array([255]), updates[1]],
  });
  const received = new Y.Doc();
  Y.applyUpdate(received, staged.state);
  expect(staged.rejected).toEqual([1]);
  expect(received.getMap("values").toJSON()).toEqual({ one: 1, two: 2 });
  const equal = await runBinaryTask({ kind: "compare", local: updates, remote: staged.state });
  expect(equal.update).toBeNull();
  document.getMap("values").delete("one");
  const deletion = await runBinaryTask({ kind: "compare", local: updates, remote: staged.state });
  expect(deletion.update).not.toBeNull();
  Y.applyUpdate(received, deletion.update!);
  expect(received.getMap("values").toJSON()).toEqual({ two: 2 });
  document.destroy();
  received.destroy();
});

test("a rejected background task does not stop queued owners from draining", async () => {
  const bad = runBinaryTask({ kind: "checkpoint", updates: [new Uint8Array([255])] });
  const owners = Array.from({ length: 10 }, (_, index) => {
    const document = new Y.Doc();
    document.getMap("values").set("owner", index);
    const update = Y.encodeStateAsUpdate(document);
    document.destroy();
    return runBinaryTask({ kind: "checkpoint", updates: [update] });
  });
  await expect(bad).rejects.toThrow();
  const results = await Promise.all(owners);
  for (const [index, result] of results.entries()) {
    const document = new Y.Doc();
    Y.applyUpdate(document, result.state);
    expect(document.getMap("values").get("owner")).toBe(index);
    document.destroy();
  }
});

test("pending causal bytes are pending until the relay holds them", async () => {
  const source = new Y.Doc();
  const updates: Uint8Array[] = [];
  source.on("update", (update: Uint8Array) => updates.push(update));
  source.getMap("values").set("one", 1);
  source.getMap("values").set("two", 2);
  const missing = await runBinaryTask({ kind: "compare", local: [updates[1]], remote: empty });
  expect(missing.update).not.toBeNull();
  const held = await runBinaryTask({ kind: "compare", local: [updates[1]], remote: updates[1] });
  expect(held.update).toBeNull();
  source.destroy();
});

test("staging does not accept unvalidated content hidden behind a causal gap", async () => {
  const source = new Y.Doc();
  const updates: Uint8Array[] = [];
  source.on("update", (update: Uint8Array) => updates.push(update));
  source.getMap("values").set("predecessor", true);
  source.transact(() => {
    source.getMap("records").set("picture", "picture-record");
    source.getMap("picture-record").set("asset", { sha256: "invalid" });
  });
  const staged = await runBinaryTask({ kind: "stage", base: empty, updates: [updates[1]] });
  expect(staged.rejected).toEqual([0]);
  expect(staged.update).toBeNull();
  source.destroy();
});

test("queued owners wait for admission before capturing snapshots and can cancel without running", async () => {
  const { binaryQueueStatus } = await import("./binary-background");
  const gate = Promise.withResolvers<void>();
  const first = runBinaryTask(async () => {
    await gate.promise;
    return { kind: "checkpoint", updates: [empty] };
  });
  const abort = new AbortController();
  let snapshots = 0;
  const waiting = Array.from({ length: 40 }, () =>
    runBinaryTask(async () => {
      snapshots++;
      return { kind: "checkpoint", updates: [empty] };
    }, abort.signal),
  );
  const outcomes = Promise.allSettled(waiting);
  expect(binaryQueueStatus()).toEqual({ active: true, queued: 32, waiting: 8 });
  expect(snapshots).toBe(0);
  abort.abort(new Error("Owner closed"));
  const settled = await outcomes;
  expect(settled.every(({ status }) => status === "rejected")).toBe(true);
  expect(snapshots).toBe(0);
  gate.resolve();
  await first;
  expect(binaryQueueStatus()).toEqual({ active: false, queued: 0, waiting: 0 });
});

test("background infrastructure failures stay distinct from invalid document bytes", async () => {
  const { InvalidBinaryTask } = await import("./binary-task-types");
  await expect(runBinaryTask({ kind: "checkpoint", updates: [new Uint8Array([255])] })).rejects.toBeInstanceOf(
    InvalidBinaryTask,
  );
  const error = new Error("Snapshot database unavailable");
  await expect(
    runBinaryTask(async () => {
      throw error;
    }),
  ).rejects.toBe(error);
});
