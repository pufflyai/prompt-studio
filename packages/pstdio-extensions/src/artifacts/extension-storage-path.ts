export const ARTIFACT_MOUNT_ROOT = ".pstdio/extension-storage";
export const EXTENSION_PUBLISHERS_DIR = ".publishers";
export const isWindowsDeviceName = (name: string) => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);

export const extensionStorageDirectory = (extensionId: string) => {
  if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(extensionId)) throw new Error("Invalid extension storage owner");
  // Windows reserves the part before the first dot, including when an extension follows it.
  const owner = canonicalExtensionId(extensionId);
  return isWindowsDeviceName(owner) ? `_${owner}` : owner;
};

export interface ExtensionStorageOwner {
  name: string;
  extensionId: string;
}

export const extensionFilesPath = (owner: ExtensionStorageOwner) => {
  return `${ARTIFACT_MOUNT_ROOT}/${extensionStorageDirectory(owner.extensionId)}`;
};

import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
