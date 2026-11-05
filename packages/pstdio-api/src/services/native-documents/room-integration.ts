import type { StorageOwner } from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

export const integrateNativeRoom = async (
  storage: ExtensionsRouteDeps["extensionStorageService"],
  owner: StorageOwner,
  roomId: string,
  integratedRevision?: number,
) => {
  const source = await storage.nativeRooms.read({ owner, roomId });
  try {
    // Closing an acknowledged room does not write to a source that has since been removed.
    if (source.revision === integratedRevision) return source.revision;
    await storage
      .openNativeTextDocument({ owner, fileId: source.documentKey })
      .applySource(source.document, { generation: source.generation });
    return source.revision;
  } finally {
    source.document.destroy();
  }
};
