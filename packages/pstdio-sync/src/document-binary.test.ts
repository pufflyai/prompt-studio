import { expect, test } from "bun:test";
import * as Y from "yjs";
import {
  acceptDocumentCheckpoint,
  exportDocumentBinary,
  snapshotDocumentBinary,
  trackDocumentBinary,
} from "./document-binary";

test("a prepared checkpoint retains edits accepted after its captured revision", () => {
  const document = new Y.Doc();
  trackDocumentBinary(document, new Uint8Array([0, 0]));
  document.getMap("values").set("one", 1);
  const snapshot = snapshotDocumentBinary(document);
  document.getMap("values").set("two", 2);
  acceptDocumentCheckpoint(document, snapshot.revision, Y.mergeUpdates(snapshot.updates));
  const reopened = new Y.Doc();
  Y.applyUpdate(reopened, exportDocumentBinary(document));
  expect(reopened.getMap("values").toJSON()).toEqual({ one: 1, two: 2 });
  document.destroy();
  reopened.destroy();
});

test("binary checkpoints preserve causal gaps before an offline predecessor returns", async () => {
  const { applyDocumentBinaryUpdate } = await import("./document-binary");
  const { runBinaryTask } = await import("./binary-background");
  const source = new Y.Doc();
  const updates: Uint8Array[] = [];
  source.on("update", (update: Uint8Array) => updates.push(update));
  source.getMap("values").set("one", 1);
  source.getMap("values").set("two", 2);
  const received = new Y.Doc();
  trackDocumentBinary(received, new Uint8Array([0, 0]));
  applyDocumentBinaryUpdate(received, updates[1]);
  received.getMap("other").set("local", true);
  const snapshot = snapshotDocumentBinary(received);
  const checkpoint = await runBinaryTask({ kind: "checkpoint", updates: snapshot.updates });
  const restarted = new Y.Doc();
  Y.applyUpdate(restarted, checkpoint.state);
  Y.applyUpdate(restarted, updates[0]);
  expect(restarted.getMap("values").toJSON()).toEqual({ one: 1, two: 2 });
  expect(restarted.getMap("other").toJSON()).toEqual({ local: true });
  for (const document of [source, received, restarted]) document.destroy();
});
