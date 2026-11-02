import type { StorageOwner } from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

export const integrateNativeRoom = async (
  storage: ExtensionsRouteDeps["extensionStorageService"],
  owner: StorageOwner,
  roomId: string,
) => {
  const source = await storage.nativeRooms.read({ owner, roomId });
  try {
    await storage.openNativeTextDocument({ owner, fileId: source.documentKey }).applySource(source.document);
  } finally {
    source.document.destroy();
  }
};
