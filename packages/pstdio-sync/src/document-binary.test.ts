import { expect, spyOn, test } from "bun:test";
import * as Y from "yjs";
import {
  acceptDocumentCheckpoint,
  exportDocumentBinary,
  snapshotDocumentBinary,
  trackDocumentBinary,
} from "./document-binary";
import { namedRootWireFixture } from "./document-binary.fixture";
import originalWire from "./document-binary.fixture.json";

test("named root updates preserve the original Yjs wire bytes and offline identities", () => {
  expect(namedRootWireFixture()).toEqual(originalWire);
});

test("encoding named roots does not enumerate unrelated shared roots", () => {
  const document = new Y.Doc();
  const roots = Array.from({ length: 100 }, (_, index) => document.getMap(`record-${index}`));
  const updates: Uint8Array[] = [];
  document.on("update", (update: Uint8Array) => updates.push(update));
  const scan = spyOn(document.share, "entries");
  try {
    document.transact(() => {
      for (const [index, root] of roots.entries()) root.set("value", index);
    });
    const snapshot = Y.encodeStateAsUpdate(document);
    expect(updates).toHaveLength(1);
    expect(scan).not.toHaveBeenCalled();
    const received = new Y.Doc();
    try {
      Y.applyUpdate(received, snapshot);
      const decodedScan = spyOn(received.share, "entries");
      try {
        expect(Y.encodeStateAsUpdate(received)).toEqual(snapshot);
        expect(received.getMap("record-99").get("value")).toBe(99);
        expect(Y.encodeStateAsUpdate(received)).toEqual(snapshot);
        expect(decodedScan).not.toHaveBeenCalled();
      } finally {
        decodedScan.mockRestore();
      }
    } finally {
      received.destroy();
    }
  } finally {
    scan.mockRestore();
    document.destroy();
  }
});

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
