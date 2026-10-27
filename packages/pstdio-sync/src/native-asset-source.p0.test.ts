import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import * as Y from "yjs";
import { applyDocumentEdit } from "./document-edits";
import { bindRecordTextAsset } from "./native-record-source";
import { adoptResourceDocument } from "./resource-document";
import { importTextSource } from "./text-source-import";

test("equal independently imported native asset histories can first join their record histories", async () => {
  const first = new Y.Doc(),
    second = new Y.Doc(),
    leftText = new Y.Doc(),
    rightText = new Y.Doc(),
    key = "8".repeat(64);
  try {
    const asset = { sha256: createHash("sha256").update("abc").digest("hex"), byteLength: 3, mediaType: "text/plain" };
    const edit = { recordId: "file", replace: { name: "note.md" }, asset };
    applyDocumentEdit(first, edit);
    applyDocumentEdit(second, edit);
    const base = Y.encodeStateAsUpdate(first);
    await importTextSource(leftText, key, "abc");
    await importTextSource(rightText, key, "abc");
    bindRecordTextAsset(first, "file", key, Y.encodeStateAsUpdate(leftText));
    bindRecordTextAsset(second, "file", key, Y.encodeStateAsUpdate(rightText));
    let joined: Awaited<ReturnType<typeof adoptResourceDocument>> | undefined, rejected: unknown;
    try {
      joined = await adoptResourceDocument(
        "file",
        [Y.encodeStateAsUpdate(second)],
        [Y.encodeStateAsUpdate(first)],
        base,
      );
    } catch (error) {
      rejected = error;
    }
    console.log("equal asset adoption failure:", String(rejected));
    expect(rejected).toBeUndefined();
    expect(joined?.record.nativeSources?.[key]).toBeDefined();
  } finally {
    first.destroy();
    second.destroy();
    leftText.destroy();
    rightText.destroy();
  }
});
