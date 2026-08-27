import type { ExtensionPackageFilesApi } from "pstdio-api-contracts/extension-kernel";
import { createFileMount } from "pstdio-extensions";

export const createExtensionPackageFilesApi = (sourcePath: string): ExtensionPackageFilesApi => {
  const mount = createFileMount(sourcePath);
  return {
    exists: mount.exists,
    readText: mount.readText,
    readBytes: mount.readBytes,
    list: mount.list,
    listDirs: mount.listDirs,
  };
};
