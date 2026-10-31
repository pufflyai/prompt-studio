import { expect, test } from "bun:test";
import { contributionRefId } from "@pstdio/sdk/extensions";
import { createNativeSourceKey } from "pstdio-api-contracts";
import { createSyncSpace, sealState, sealUpdate } from "pstdio-sync/encryption";
import { seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { readEncryptedPublicText } from "./packaged-public-text-encryption.fixture";
import { packagedProjectKey } from "./packaged-sync-project-key.fixture";

test("encrypted public text inspection reconstructs the selected source's founding state and authored tail", async () => {
  const space = await createSyncSpace({ projectId: "project", spaceOwner: null, keys: [packagedProjectKey] });
  const extensionId = "paper.public-text-source";
  const mount = contributionRefId({ kind: "artifact-mount", extensionId, id: "documents" });
  const sourceKey = createNativeSourceKey(["artifact", mount, "selected"]);
  const documentId = await space.documentId(
    JSON.stringify([extensionId, JSON.stringify(["native-markdown", sourceKey])]),
  );
  const document = new Y.Doc();
  try {
    await seedTextDocument(document, "Shared source");
    const state = await sealState(space, documentId, {
      baseStateId: null,
      through: 0,
      state: Y.encodeStateAsUpdate(document),
      summary: Y.encodeStateVector(document),
      blobIds: [],
    });
    const vector = Y.encodeStateVector(document);
    document.getText("content").insert(0, "public-two-host-secret: ");
    const update = await sealUpdate(space, documentId, Y.encodeStateAsUpdate(document, vector), []);
    const result = await readEncryptedPublicText(space, {
      documents: [[`~${documentId}`, { state, payload: state.payload, updates: [{ ...update, sequence: 1 }] }]],
      blobs: [],
    });
    expect(result.documentId).toBe(documentId);
    expect(result.text).toBe("public-two-host-secret: Shared source");
    expect(result.updates).toHaveLength(1);
  } finally {
    document.destroy();
  }
});
