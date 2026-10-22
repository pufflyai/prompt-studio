import { expect, test } from "bun:test";
import * as Y from "yjs";
import { runBinaryTask } from "./binary-background";

test("background compaction reclaims deleted content and preserves an offline causal gap", async () => {
  const source = new Y.Doc();
  const updates: Uint8Array[] = [];
  source.on("update", (update: Uint8Array) => updates.push(update));
  source.getMap("old").set("body", "deleted payload\n".repeat(1000));
  source.getMap("old").delete("body");
  const offline = new Y.Doc();
  const late: Uint8Array[] = [];
  offline.on("update", (update: Uint8Array) => late.push(update));
  offline.getMap("offline").set("first", 1);
  offline.getMap("offline").set("second", 2);
  const before = Y.mergeUpdates([...updates, late[1]]);
  const compacted = await runBinaryTask({ kind: "compact", updates: [before] });
  expect(compacted.state.length).toBeLessThan(before.length);
  const reopened = new Y.Doc();
  Y.applyUpdate(reopened, compacted.state);
  Y.applyUpdate(reopened, updates[0]);
  expect(reopened.getMap("old").size).toBe(0);
  Y.applyUpdate(reopened, late[0]);
  expect(reopened.getMap("offline").toJSON()).toEqual({ first: 1, second: 2 });
  expect(Y.encodeStateVector(reopened)).toEqual(Y.encodeStateVectorFromUpdate(Y.mergeUpdates([...updates, ...late])));
  source.destroy();
  offline.destroy();
  reopened.destroy();
});
