export const localDocumentKey = (id: string) =>
  id === "records" ||
  id === "resource-identities" ||
  id.startsWith('["resource",') ||
  id.startsWith('["host-local-migration",') ||
  id.startsWith('["ordered-');

export const nativeDocumentId = (key: string) => JSON.stringify(["native-markdown", key]);
export const roomDocumentId = (id: string) => JSON.stringify(["editor-room", id]);

export const assertNotRetainedDocument = (key: string) => {
  if (key.startsWith('["ordered-retention",'))
    throw new Error("Private retained storage cannot be opened or discarded as a shared document");
};
