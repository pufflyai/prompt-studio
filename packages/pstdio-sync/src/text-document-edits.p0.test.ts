import { expect, test } from "bun:test";
import * as Y from "yjs";
import { mergeTextDocuments } from "./text-document-adoption";
import { applyTextEditorUpdate, editTextDocument, ownTextDeletions, ownTextInsertions } from "./text-document-edits";
import { seedTextDocument } from "./text-document-seed";

test("editor updates record newly applied user deletions once across retries", async () => {
  const host = new Y.Doc();
  await seedTextDocument(host, "abc");
  const browser = new Y.Doc();
  Y.applyUpdate(browser, Y.encodeStateAsUpdate(host));
  const original = Y.createRelativePositionFromTypeIndex(host.getText("content"), 1).item!;
  let update: Uint8Array = new Uint8Array();
  browser.on("update", (value: Uint8Array) => {
    update = value;
  });
  browser.getText("content").delete(1, 1);
  applyTextEditorUpdate(host, update);
  expect(host.getText("content").toString()).toBe("ac");
  expect(ownTextDeletions(host)(original)).toBe(true);
  const state = Y.encodeStateAsUpdate(host);
  applyTextEditorUpdate(host, update);
  expect(Y.encodeStateAsUpdate(host)).toEqual(state);
  host.destroy();
  browser.destroy();
});

test("historical translated delete sets in a catch-up update are not re-authored", async () => {
  const first = new Y.Doc();
  const second = new Y.Doc();
  await seedTextDocument(first, "abc");
  await seedTextDocument(second, "abc");
  const original = Y.createRelativePositionFromTypeIndex(second.getText("content"), 1).item!;
  editTextDocument(first, (text) => text.delete(1, 1));
  const host = await mergeTextDocuments(first, second);
  expect(host.getText("content").toString()).toBe("ac");
  expect(ownTextDeletions(host)(original)).toBe(false);
  const browser = new Y.Doc();
  Y.applyUpdate(browser, Y.encodeStateAsUpdate(host));
  const before = Y.encodeStateVector(browser);
  browser.getText("content").insert(0, "X");
  const update = Y.encodeStateAsUpdate(browser, before);
  expect(Y.decodeUpdate(update).ds.clients.size).toBeGreaterThan(0);
  applyTextEditorUpdate(host, update);
  expect(host.getText("content").toString()).toBe("Xac");
  expect(ownTextDeletions(host)(original)).toBe(false);
  for (const document of [first, second, host, browser]) document.destroy();
});

test("user insertion origin does not relabel earlier translated characters from the same worker", async () => {
  const first = new Y.Doc();
  const second = new Y.Doc();
  await seedTextDocument(first, "abc");
  await seedTextDocument(second, "abc");
  editTextDocument(first, (text) => text.insert(0, "X"));
  const sourceId = Y.createRelativePositionFromTypeIndex(first.getText("content"), 0).item!;
  expect(ownTextInsertions(first)(sourceId)).toBe(true);
  const merged = await mergeTextDocuments(first, second);
  const translated = Y.createRelativePositionFromTypeIndex(merged.getText("content"), 0).item!;
  expect(ownTextInsertions(merged)(translated)).toBe(false);
  editTextDocument(merged, (text) => text.insert(text.length, "Y"));
  const authored = Y.createRelativePositionFromTypeIndex(merged.getText("content"), 4).item!;
  expect(ownTextInsertions(merged)(authored)).toBe(true);
  expect(ownTextInsertions(merged)(translated)).toBe(false);
  for (const document of [first, second, merged]) document.destroy();
});
