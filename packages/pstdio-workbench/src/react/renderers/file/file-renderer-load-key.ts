interface FileRendererLoadKeyInput {
  fileRendererId: string;
  resourceUri: string | undefined;
  resourceMetadata?: Record<string, unknown>;
}

// Metadata selects which document a resource shows (e.g. one ticket resource
// carrying the file the tree picked), so it belongs to the document's identity.
// Sorted keys keep the key stable when a caller rebuilds metadata in another order.
const serializeResourceMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return "";
  const entries = Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
};

export const createFileRendererLoadKey = (input: FileRendererLoadKeyInput) => {
  const { fileRendererId, resourceUri, resourceMetadata } = input;
  return `${fileRendererId}:${resourceUri ?? ""}:${serializeResourceMetadata(resourceMetadata)}`;
};

export const isCurrentLoadedFile = (loaded: { loadKey: string } | null, loadKey: string) => loaded?.loadKey === loadKey;
