import { fingerprint } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { documentAuthorId, encodeBytes } from "../shared";
import { saveTextDocument } from "./text-document-edits";
import { readTextDocumentSeed } from "./text-document-seed";

/** Retry an observed file change from the exact last projection, never from newer peer text. */
export const editProjectedText = async (baseline: Uint8Array, source: string) => {
  const document = new Y.Doc({ gc: false });
  try {
    Y.applyUpdate(document, baseline);
    if (document.store.pendingStructs || document.store.pendingDs)
      throw new Error("The file projection is missing causal history");
    await readTextDocumentSeed(document);
    if (document.getText("content").toString() !== source) {
      // A crash can occur after canonical integration but before the projection baseline advances.
      // The same observation must produce the same inserts and deletion provenance on replay.
      const cause = await fingerprint({ baseline: encodeBytes(baseline), source });
      document.clientID = documentAuthorId(`native-file-projection:${cause}`);
      saveTextDocument(document, source);
    }
    return document;
  } catch (error) {
    document.destroy();
    throw error;
  }
};
