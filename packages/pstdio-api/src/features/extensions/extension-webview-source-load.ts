import { extensionLoadKeyForHost as extensionLoadKey } from "pstdio-extensions";
import type { LoadedExtension, LoadedExtensionSnapshot } from "./extension-runtime";
import type { createWebviewBuildBackoff } from "./extension-webview-build-backoff";
import type { InstalledSourceWithManifest } from "./extension-webview-build-runner";

// A failed import still returns the manifest, with an error diagnostic in place of the
// contributions, so only a clean load tells which webviews the extension has.
interface SourceLoadInput {
  backoff: ReturnType<typeof createWebviewBuildBackoff>;
  loadSource: (sourcePath: string) => Promise<LoadedExtension>;
  onError?: (error: unknown) => void;
  row: InstalledSourceWithManifest;
  validatedSource?: LoadedExtensionSnapshot;
}

const loadWebviewSource = async (input: SourceLoadInput) => {
  const { backoff, loadSource, onError, row } = input;
  let key: string | undefined;
  try {
    while (true) {
      key = await extensionLoadKey(row.source_path);
      if (input.validatedSource?.loadKey === key) return input.validatedSource;
      if (backoff.isBlocked(row.id, key)) return null;
      const loaded = await loadSource(row.source_path);
      if (loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error")) break;
      if (key !== (await extensionLoadKey(row.source_path))) continue;
      return { loaded, loadKey: key };
    }
  } catch (error) {
    onError?.(error);
  }
  // Files that could not be read to compute the key record nothing, so the next request tries again.
  if (key) backoff.recordFailure(row.id, key);
  return null;
};

export const loadCurrentWebviewSource = async (
  input: Omit<SourceLoadInput, "row"> & {
    installedExtensionId: string;
    listInstalledSources: () => Promise<InstalledSourceWithManifest[]>;
  },
) => {
  while (true) {
    const row = (await input.listInstalledSources()).find((row) => row.id === input.installedExtensionId);
    if (!row) return null;
    const snapshot = await loadWebviewSource({ ...input, row });
    if (!snapshot) return null;
    const current = (await input.listInstalledSources()).find((row) => row.id === input.installedExtensionId);
    if (!current) return null;
    if (row.source_path !== current.source_path || snapshot.loadKey !== (await extensionLoadKey(current.source_path)))
      continue;
    return { row: current, snapshot };
  }
};
