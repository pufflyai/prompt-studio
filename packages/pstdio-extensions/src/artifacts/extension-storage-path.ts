export const ARTIFACT_MOUNT_ROOT = ".pstdio/extension-storage";
export const EXTENSION_PUBLISHERS_DIR = ".publishers";

export interface ExtensionStorageOwner {
  name: string;
  extensionId: string;
}

export const extensionFilesPath = (owner: ExtensionStorageOwner) => {
  const publisher = owner.extensionId.split(".")[0];
  return `${ARTIFACT_MOUNT_ROOT}/${owner.name}/${EXTENSION_PUBLISHERS_DIR}/${publisher}`;
};
