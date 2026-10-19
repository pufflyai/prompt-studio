export { createFileRendererLoadKey } from "pstdio-api-contracts";
export const isCurrentLoadedFile = (
  loaded: {
    loadKey: string;
  } | null,
  loadKey: string,
) => loaded?.loadKey === loadKey;
