import { expect, test } from "bun:test";
import * as Y from "yjs";
import { applyDocumentEdit } from "./document-edits";
import { readDocumentRecord } from "./document-record";
import { bindRecordText, prepareRecordTextEdit } from "./native-record-source";
import { adoptResourceDocument } from "./resource-document";

test("bound record fields keep metadata writes separate from their standalone text authority", async () => {
  const document = new Y.Doc();
  applyDocumentEdit(document, { recordId: "ticket", replace: { title: "Plan", content: "first\nlast" } });
  bindRecordText(document, "ticket", { documentKey: "a".repeat(64), field: "/content" });
  const writes: { documentKey: string; content: string }[] = [];
  const edit = prepareRecordTextEdit(
    document,
    { recordId: "ticket", replace: { title: "Renamed", content: "PEER first\nlast" } },
    (write) => writes.push(write),
  );
  applyDocumentEdit(document, edit);
  const record = await readDocumentRecord(document, "ticket");
  expect(writes).toEqual([{ documentKey: "a".repeat(64), content: "PEER first\nlast" }]);
  expect(record.value).toEqual({ title: "Renamed", content: "first\nlast" });
  expect(record.nativeSources).toMatchObject({ ["a".repeat(64)]: { field: "/content", original: "first\nlast" } });
  document.destroy();
});

test("late unbound writes retain their original text instead of silently replacing a bound field", async () => {
  const document = new Y.Doc();
  applyDocumentEdit(document, { recordId: "ticket", replace: { content: "first\nlast" } });
  const oldDevice = new Y.Doc();
  Y.applyUpdate(oldDevice, Y.encodeStateAsUpdate(document));
  bindRecordText(document, "ticket", { documentKey: "a".repeat(64), field: "/content" });
  applyDocumentEdit(oldDevice, { recordId: "ticket", replace: { content: "OFFLINE first\nlast" } });
  Y.applyUpdate(document, Y.encodeStateAsUpdate(oldDevice));
  await expect(readDocumentRecord(document, "ticket")).rejects.toThrow("pre-binding");
  oldDevice.destroy();
  document.destroy();
});

test("concurrent bindings of different record fields retain both standalone authorities", async () => {
  const first = new Y.Doc();
  applyDocumentEdit(first, { recordId: "ticket", replace: { content: "body", notes: "notes" } });
  const second = new Y.Doc();
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  bindRecordText(first, "ticket", { documentKey: "a".repeat(64), field: "/content" });
  bindRecordText(second, "ticket", { documentKey: "b".repeat(64), field: "/notes" });
  Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
  const record = await readDocumentRecord(first, "ticket");
  expect(Object.keys(record.nativeSources ?? {}).sort()).toEqual(["a".repeat(64), "b".repeat(64)]);
  first.destroy();
  second.destroy();
});

test("joining bound records preserves a different saved pre-binding body for recovery", async () => {
  const local = new Y.Doc();
  const remote = new Y.Doc();
  applyDocumentEdit(local, { recordId: "ticket", replace: { content: "saved offline" } });
  applyDocumentEdit(remote, { recordId: "ticket", replace: { content: "saved remotely" } });
  bindRecordText(remote, "ticket", { documentKey: "a".repeat(64), field: "/content" });
  const localState = Y.encodeStateAsUpdate(local);
  await expect(
    adoptResourceDocument("ticket", [Y.encodeStateAsUpdate(remote)], [localState], localState),
  ).rejects.toThrow("pre-binding");
  expect((await readDocumentRecord(local, "ticket")).value).toEqual({ content: "saved offline" });
  local.destroy();
  remote.destroy();
});

test("first joining an ordinary equal-source record retains its local source binding", async () => {
  const local = new Y.Doc();
  const remote = new Y.Doc();
  applyDocumentEdit(local, { recordId: "ticket", replace: { content: "same saved source" } });
  applyDocumentEdit(remote, { recordId: "ticket", replace: { content: "same saved source" } });
  const base = Y.encodeStateAsUpdate(local);
  bindRecordText(local, "ticket", { documentKey: "a".repeat(64), field: "/content" });
  const adopted = await adoptResourceDocument(
    "ticket",
    [Y.encodeStateAsUpdate(remote)],
    [Y.encodeStateAsUpdate(local)],
    base,
  );
  expect(adopted.record.nativeSources?.["a".repeat(64)]).toMatchObject({
    field: "/content",
    original: "same saved source",
  });
  expect(adopted.update).not.toBeNull();
  local.destroy();
  remote.destroy();
});

test("a late unbound recreation with equal bytes cannot inherit a retired text authority", async () => {
  const first = new Y.Doc();
  const offline = new Y.Doc();
  try {
    applyDocumentEdit(first, { recordId: "file", replace: { content: "same bytes" } });
    Y.applyUpdate(offline, Y.encodeStateAsUpdate(first));
    bindRecordText(first, "file", { documentKey: "7".repeat(64), field: "/content" });
    applyDocumentEdit(offline, { recordId: "file", deleted: true });
    applyDocumentEdit(offline, { recordId: "file", deleted: false, replace: { content: "same bytes" } });
    Y.applyUpdate(first, Y.encodeStateAsUpdate(offline));
    await expect(readDocumentRecord(first, "file")).rejects.toMatchObject({ code: "native_source_recovery" });
    expect((await readDocumentRecord(offline, "file")).value).toEqual({ content: "same bytes" });
  } finally {
    first.destroy();
    offline.destroy();
  }
});

test("adoption preserves an independently recreated equal-byte source for recovery", async () => {
  const local = new Y.Doc();
  const remote = new Y.Doc();
  try {
    applyDocumentEdit(local, { recordId: "file", replace: { content: "same bytes" } });
    const base = Y.encodeStateAsUpdate(local);
    bindRecordText(local, "file", { documentKey: "8".repeat(64), field: "/content" });
    applyDocumentEdit(remote, { recordId: "file", replace: { content: "same bytes" } });
    applyDocumentEdit(remote, { recordId: "file", deleted: true });
    applyDocumentEdit(remote, { recordId: "file", deleted: false, replace: { content: "same bytes" } });
    await expect(
      adoptResourceDocument("file", [Y.encodeStateAsUpdate(remote)], [Y.encodeStateAsUpdate(local)], base),
    ).rejects.toMatchObject({ code: "native_source_recovery" });
  } finally {
    local.destroy();
    remote.destroy();
  }
});
