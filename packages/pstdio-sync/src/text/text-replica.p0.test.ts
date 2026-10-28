import { expect, test } from "bun:test";
import * as Y from "yjs";
import { createTextReplica } from "./text-replica";

const snapshot = (document: Y.Doc, seedId = "first") => ({
  state: Y.encodeStateAsUpdate(document),
  seedId,
  sourceSeedId: seedId,
});
const read = (state: Uint8Array) => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const text = doc.getText("content").toString();
  doc.destroy();
  return text;
};

test("local frames retain a received baseline and acknowledge only their captured batch", () => {
  const host = new Y.Doc();
  host.getText("content").insert(0, "first");
  const replica = createTextReplica(snapshot(host));
  replica.document.getText("content").insert(5, " local");
  const captured = replica.capture();
  expect(read(replica.receivedState())).toBe("first");
  replica.document.getText("content").insert(11, " later");
  Y.applyUpdate(host, captured.update!);
  replica.acknowledge(captured.count, snapshot(host));
  expect(replica.pending()).toBe(true);
  expect(read(replica.receivedState())).toBe("first local");
  expect(replica.document.getText("content").toString()).toBe("first local later");
  const next = replica.capture();
  Y.applyUpdate(host, next.update!);
  replica.acknowledge(next.count, snapshot(host));
  expect(replica.pending()).toBe(false);
  replica.dispose();
  host.destroy();
});

test("peer changes merge with local frames without entering the local outbox", () => {
  const host = new Y.Doc();
  host.getText("content").insert(0, "first\nlast");
  const replica = createTextReplica(snapshot(host));
  replica.document.getText("content").insert(0, "LOCAL ");
  const count = replica.capture().count;
  host.getText("content").insert(host.getText("content").length, " PEER");
  expect(replica.receive(snapshot(host))).toBe(true);
  expect(replica.capture().count).toBe(count);
  expect(replica.document.getText("content").toString()).toBe("LOCAL first\nlast PEER");
  expect(read(replica.receivedState())).toBe("first\nlast PEER");
  replica.dispose();
  host.destroy();
});

test("an adopted root cannot replace the rendering replica while local frames remain", () => {
  const first = new Y.Doc();
  first.getText("content").insert(0, "first");
  const canonical = new Y.Doc();
  canonical.getText("content").insert(0, "canonical");
  const replica = createTextReplica(snapshot(first));
  replica.document.getText("content").insert(5, " local");
  expect(replica.receive(snapshot(canonical, "second"))).toBe(false);
  expect(replica.document.getText("content").toString()).toBe("first local");
  expect(read(replica.receivedState())).toBe("first");
  expect(replica.pending()).toBe(true);
  replica.dispose();
  first.destroy();
  canonical.destroy();
});

test("an old-root acknowledgement advances the source baseline needed by a later frame", () => {
  const host = new Y.Doc();
  host.getText("content").insert(0, "first");
  const replica = createTextReplica(snapshot(host));
  replica.document.getText("content").insert(0, "PREFIX ");
  const first = replica.capture();
  Y.applyUpdate(host, first.update!);
  replica.document.getText("content").insert(3, "LATE");
  const canonical = new Y.Doc();
  canonical.getText("content").insert(0, "PREFIX first");
  const acknowledgement = {
    ...snapshot(canonical, "second"),
    sourceSeedId: "first",
    sourceState: Y.encodeStateAsUpdate(host),
  };
  replica.acknowledge(first.count, acknowledgement);
  const retry = new Y.Doc();
  Y.applyUpdate(retry, replica.receivedState());
  Y.applyUpdate(retry, replica.capture().update!);
  expect(retry.store.pendingStructs).toBeNull();
  expect(retry.getText("content").toString()).toBe("PRELATEFIX first");
  replica.dispose();
  retry.destroy();
  host.destroy();
  canonical.destroy();
});
