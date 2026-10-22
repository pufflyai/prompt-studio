import { afterEach, expect, test } from "bun:test";
import * as Y from "yjs";
import { applyDocumentEdit } from "./document-edits";
import { encodeRecordFragment } from "./document-fragment-encoding";
import { buildRecordFragments } from "./document-fragments";
import { readDocumentRecord } from "./document-record";

const documents: Y.Doc[] = [];
const createDocument = () => {
  const document = new Y.Doc();
  documents.push(document);
  return document;
};
afterEach(() => {
  for (const document of documents.splice(0)) document.destroy();
});

test("structural backfill preserves sparse original clocks without inventing omitted source state", () => {
  const source = createDocument();
  source.clientID = 101;
  for (let round = 0; round < 3; round++) {
    for (const recordId of ["a", "b", "c"])
      source.transact(() => applyDocumentEdit(source, { recordId, replace: { title: `${recordId}${round}` } }, "seed"));
  }
  const result = buildRecordFragments(source);
  const fragments = [...result.fragments];
  expect(fragments.map((fragment) => fragment.recordId).sort()).toEqual(["a", "b", "c"]);
  expect(result.clocks).toEqual(Y.decodeStateVector(Y.encodeStateVector(source)));
  const selected = fragments.find((fragment) => fragment.recordId === "b")!;
  const decoded = Y.decodeUpdate(selected.state);
  expect(decoded.structs.some((struct) => struct instanceof Y.Skip)).toBe(true);
  expect(decoded.structs.some((struct) => struct instanceof Y.GC)).toBe(false);
  const reopened = createDocument();
  Y.applyUpdate(reopened, selected.state);
  expect(reopened.store.pendingStructs).not.toBeNull();
  expect(reopened.getMap("records").has("a")).toBe(false);
  const ownership = [...result.ownership];
  expect(ownership).toHaveLength(9);
  const name = source.getMap<string>("records").get("b")!;
  const id = source.getMap(name)._map.get("value")!.id;
  const range = ownership.find(
    (entry) => entry.client === id.client && entry.startClock <= id.clock && entry.endClock > id.clock,
  );
  expect(range?.recordId).toBe("b");
});

test("backfill fragments retain deleted generations and original identities across restore", async () => {
  const source = createDocument();
  source.clientID = 101;
  const edit = (recordId: string, replace: { title: string }) =>
    source.transact(() => applyDocumentEdit(source, { recordId, replace }, "seed"));
  edit("a", { title: "original" });
  edit("b", { title: "other" });
  const offline = createDocument();
  Y.applyUpdate(offline, Y.encodeStateAsUpdate(source));
  const late: Uint8Array[] = [];
  offline.on("update", (update) => late.push(update));
  offline.transact(() => applyDocumentEdit(offline, { recordId: "a", replace: { title: "late" } }, "offline"));
  source.transact(() => applyDocumentEdit(source, { recordId: "a", deleted: true }, "delete"));
  source.transact(() =>
    applyDocumentEdit(source, { recordId: "a", deleted: false, replace: { title: "restored" } }, "restore"),
  );
  const reopened = createDocument();
  Y.applyUpdate(
    reopened,
    Y.mergeUpdates([...buildRecordFragments(source).fragments].map((fragment) => fragment.state)),
  );
  for (const update of late) for (const doc of [source, reopened]) Y.applyUpdate(doc, update);
  for (const id of ["a", "b"])
    expect(await readDocumentRecord(reopened, id)).toEqual(await readDocumentRecord(source, id));
  expect((await readDocumentRecord(reopened, "a")).value).toEqual({ title: "restored" });
  expect(Y.encodeStateVector(reopened)).toEqual(Y.encodeStateVector(source));
});

test("structural backfill keeps pending source bytes out of visible record fragments", () => {
  const source = createDocument();
  const remote = createDocument();
  const updates: Uint8Array[] = [];
  remote.on("update", (update) => updates.push(update));
  applyDocumentEdit(remote, { recordId: "a", replace: "first" }, "first");
  applyDocumentEdit(remote, { recordId: "b", replace: "pending" }, "second");
  Y.applyUpdate(source, updates.at(-1)!);
  expect(source.store.pendingStructs).not.toBeNull();
  expect([...buildRecordFragments(source).fragments]).toEqual([]);
  expect(buildRecordFragments(source).clocks.size).toBe(0);
});

test("a long selected map history does not depend on JavaScript recursion depth", async () => {
  const source = createDocument();
  for (let index = 0; index < 100_000; index++) {
    source.clientID = 101 + (index % 2);
    source.transact(() => applyDocumentEdit(source, { recordId: "a", replace: { title: String(index) } }, "history"));
  }
  const fragments = [...buildRecordFragments(source).fragments];
  const reopened = createDocument();
  Y.applyUpdate(reopened, Y.mergeUpdates(fragments.map((fragment) => fragment.state)));
  expect(await readDocumentRecord(reopened, "a")).toEqual(await readDocumentRecord(source, "a"));
});

test("authoritative GC and non-record metadata retain clocks without inventing record ownership", () => {
  const source = createDocument();
  source.clientID = 101;
  source.getMap("data-migrations").set("version", 1);
  Y.applyUpdate(source, encodeRecordFragment([new Y.GC(Y.createID(909, 0), 3)], new Map()).state);
  const indexed = buildRecordFragments(source);
  expect(indexed.clocks.get(101)).toBe(1);
  expect(indexed.clocks.get(909)).toBe(3);
  expect([...indexed.ownership]).toEqual([]);
  expect([...indexed.fragments]).toEqual([]);
});
