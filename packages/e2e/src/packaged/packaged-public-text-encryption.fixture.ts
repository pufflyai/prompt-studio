import { contributionRefId } from "@pstdio/sdk/extensions";
import { createNativeSourceKey } from "pstdio-api-contracts";
import { openState, openUpdate, type SyncSpace } from "pstdio-sync/encryption";
import { readTextDocumentSeed } from "pstdio-sync/text";
import * as Y from "yjs";
import type { RelayContents } from "./packaged-public-text-peer.fixture";

/** Source bindings travel in the record stream; editor text travels in its own encrypted Yjs document. */
export const readEncryptedPublicText = async (space: SyncSpace, contents: RelayContents) => {
  const extensionId = "paper.public-text-source";
  const mount = contributionRefId({ kind: "artifact-mount", extensionId, id: "documents" });
  // This fixture creates the source once. Both homes must share its initial lifetime.
  const source = createNativeSourceKey(["artifact", mount, "selected"]);
  const name = JSON.stringify(["native-markdown", source]);
  const documentId = await space.documentId(JSON.stringify([extensionId, name]));
  const encrypted = new Map(contents.documents).get(`~${documentId}`);
  if (!encrypted?.state || !encrypted.payload)
    throw new Error("The selected public source has no encrypted founding state");
  const document = new Y.Doc();
  try {
    Y.applyUpdate(
      document,
      await openState(space, documentId, encrypted.state, Buffer.from(encrypted.payload, "base64")),
    );
    for (const update of encrypted.updates)
      if (update.sequence > encrypted.state.through)
        Y.applyUpdate(document, await openUpdate(space, documentId, update));
    await readTextDocumentSeed(document);
    return { documentId, text: document.getText("content").toString(), updates: encrypted.updates };
  } finally {
    document.destroy();
  }
};
