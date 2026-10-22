import * as Y from "yjs";
import { applyDocumentEdit } from "./document-edits";
import { readValue, valueReference, writeText, writeValue } from "./document-values";

const restoreShared = (
  document: Y.Doc,
  record: Y.Map<unknown>,
  name: string,
  snapshot: Y.Doc,
  source: Y.Map<unknown>,
) => {
  const kind = source.get("sharedKind");
  if (!kind) {
    record.delete("sharedKind");
    record.delete("shared");
    return;
  }
  if (record.get("sharedKind") !== kind) record.set("sharedKind", kind);
  const value = readValue(source.get("shared"), snapshot);
  if (kind === "text") {
    const reference = valueReference(record, "shared", "text", name);
    writeText(document.getText(reference.name), value as string);
  } else writeValue(record, "shared", value, name);
};

/** Restore user content as new edits. Applying an old Yjs update cannot undo a deletion. */
export const restoreDocument = (document: Y.Doc, update: Uint8Array, documentId: string) => {
  const snapshot = new Y.Doc();
  try {
    Y.applyUpdate(snapshot, update);
    document.transact(() => {
      if (documentId !== "records") {
        writeText(document.getText("content"), snapshot.getText("content").toString());
        return;
      }
      const wanted = snapshot.getMap<string>("records");
      const records = document.getMap<string>("records");
      for (const id of [...records.keys()])
        if (!wanted.has(id)) applyDocumentEdit(document, { recordId: id, deleted: true });
      for (const [id, sourceName] of wanted) {
        const source = snapshot.getMap(sourceName);
        applyDocumentEdit(document, {
          recordId: id,
          deleted: false,
          replace: readValue(source.get("value"), snapshot),
          asset: structuredClone(source.get("asset") ?? null) as Parameters<typeof applyDocumentEdit>[1]["asset"],
        });
        const name = records.get(id)!;
        restoreShared(document, document.getMap(name), name, snapshot, source);
      }
    });
  } finally {
    snapshot.destroy();
  }
};
