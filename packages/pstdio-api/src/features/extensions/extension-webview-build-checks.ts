import { processKey } from "./extension-webview-build-backoff";

// Tracks which webviews were used in this process and which are checked against their sources.
export const createWebviewBuildChecks = () => {
  const used = new Map<string, Set<string>>();
  const checked = new Set<string>();
  const pending = new Map<string, Promise<void>>();

  // Waiters see every check queued for their webview, while each caller can await only its own work.
  const track = (installedExtensionId: string, webviewIds: string[], work: Promise<void>) => {
    for (const webviewId of webviewIds) {
      const key = processKey(installedExtensionId, webviewId);
      const completion = Promise.all([pending.get(key), work]).then(() => {
        if (pending.get(key) !== completion) return;
        pending.delete(key);
        checked.add(key);
      });
      pending.set(key, completion);
    }
  };

  const use = (installedExtensionId: string, webviewId: string, startCheck: () => void) => {
    const webviews = used.get(installedExtensionId) ?? new Set<string>();
    webviews.add(webviewId);
    used.set(installedExtensionId, webviews);
    const key = processKey(installedExtensionId, webviewId);
    if (!pending.has(key) && !checked.has(key)) startCheck();
    return pending.get(key) ?? Promise.resolve();
  };

  // A source change makes every earlier check of that source stale.
  const reset = (installedExtensionId: string) => {
    const prefix = processKey(installedExtensionId, "");
    for (const key of checked) if (key.startsWith(prefix)) checked.delete(key);
    return [...(used.get(installedExtensionId) ?? [])];
  };

  const clear = () => {
    used.clear();
    checked.clear();
    pending.clear();
  };

  return { clear, reset, track, use };
};
