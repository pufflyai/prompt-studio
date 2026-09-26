import type { ExtensionPackageFilesApi } from "pstdio-api-contracts/extension-kernel";
import { createFileMount } from "pstdio-extensions";

export const createExtensionPackageFilesApi = (sourcePath: string, signal?: AbortSignal): ExtensionPackageFilesApi => {
  const mount = createFileMount(sourcePath, signal);
  return {
    exists: mount.exists,
    readText: mount.readText,
    readBytes: mount.readBytes,
    list: mount.list,
    listDirs: mount.listDirs,
  };
};
