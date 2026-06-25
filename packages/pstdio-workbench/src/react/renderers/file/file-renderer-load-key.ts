interface FileRendererLoadKeyInput {
  fileRendererId: string;
  resourceUri: string | undefined;
}

interface FileRendererDocumentKeyInput {
  loadKey: string;
  documentId: string | undefined;
  fileName: string | undefined;
  mimeType: string | undefined;
}

export const createFileRendererLoadKey = (input: FileRendererLoadKeyInput) => {
  const { fileRendererId, resourceUri } = input;
  return `${fileRendererId}:${resourceUri ?? ""}`;
};

export const createFileRendererDocumentKey = (input: FileRendererDocumentKeyInput) => {
  const { loadKey, documentId, fileName, mimeType } = input;
  return JSON.stringify([loadKey, documentId ?? fileName ?? "", mimeType ?? ""]);
};

export const isCurrentLoadedFile = (loaded: { loadKey: string } | null, loadKey: string) => loaded?.loadKey === loadKey;
