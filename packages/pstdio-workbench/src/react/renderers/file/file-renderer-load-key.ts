interface FileRendererLoadKeyInput {
  fileRendererId: string;
  resourceUri: string | undefined;
}

export const createFileRendererLoadKey = (input: FileRendererLoadKeyInput) => {
  const { fileRendererId, resourceUri } = input;
  return `${fileRendererId}:${resourceUri ?? ""}`;
};

export const isCurrentLoadedFile = (loaded: { loadKey: string } | null, loadKey: string) => loaded?.loadKey === loadKey;
