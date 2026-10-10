import { extensionLoadKey } from "pstdio-extensions";
import type { LoadedExtension } from "./extension-runtime";
import type { createWebviewBuildBackoff } from "./extension-webview-build-backoff";
import type { InstalledSourceWithManifest } from "./extension-webview-build-runner";

// A failed import still returns the manifest, with an error diagnostic in place of the
// contributions, so only a clean load tells which webviews the extension has.
export const loadWebviewSource = async (input: {
  backoff: ReturnType<typeof createWebviewBuildBackoff>;
  loadSource: (sourcePath: string) => Promise<LoadedExtension>;
  onError?: (error: unknown) => void;
  row: InstalledSourceWithManifest;
}) => {
  const { backoff, loadSource, onError, row } = input;
  let key: string | undefined;
  try {
    key = extensionLoadKey(row.source_path);
    if (backoff.isBlocked(row.id, key)) return null;
    const loaded = await loadSource(row.source_path);
    if (!loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error")) return loaded;
  } catch (error) {
    onError?.(error);
  }
  // Files that could not be read to compute the key record nothing, so the next request tries again.
  if (key) backoff.recordFailure(row.id, key);
  return null;
};
