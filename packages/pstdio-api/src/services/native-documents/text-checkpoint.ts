import { initialTextDocumentState } from "pstdio-sync/text";
import * as Y from "yjs";

export const checkpointText = (state: Uint8Array) => {
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, state);
    return document.getText("content").toString();
  } finally {
    document.destroy();
  }
};
export const checkpointInitialState = async (state: Uint8Array) => {
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, state);
    return await initialTextDocumentState(document);
  } finally {
    document.destroy();
  }
};
