import { releaseBundleHost } from "pstdio-extensions/distribution";
import { runExtensionPreparation } from "./extension-preparation";
import type { ExtensionReleasePrefetchTarget } from "./warm-extension-release";

const retryDelay = 15_000;
const refreshDelay = 15 * 60_000;

export const createExtensionReleasePrefetcher = (whenQuiet?: (run: () => void) => () => void) => {
  const recent = new Map<string, number>();
  const running = new Set<string>();
  const pending = new Map<string, ExtensionReleasePrefetchTarget>();
  let ready = !whenQuiet;
  let disposed = false;
  let cancel: (() => void) | undefined;
  const prefetch = (target: ExtensionReleasePrefetchTarget) => {
    const key =
      "origin" in target
        ? target.sha256
        : target.release.bundles?.find(
            (bundle) => bundle.host === releaseBundleHost() && bundle.sourceSha256 === target.release.sha256,
          )?.sha256;
    if (!key || disposed || running.size >= 2) return;
    if (!ready && whenQuiet) {
      if (pending.size < 2) pending.set(key, target);
      cancel ??= whenQuiet(() => {
        ready = true;
        for (const queued of pending.values()) prefetch(queued);
        pending.clear();
      });
      return;
    }
    if (running.has(key) || (recent.get(key) ?? 0) > Date.now()) return;
    running.add(key);
    void runExtensionPreparation("release.prefetch", target, {
      priority: "background",
      preserveActiveContinuation: true,
      resources: [`release:${key}`],
    })
      .then(
        () => recent.set(key, Date.now() + refreshDelay),
        () => recent.set(key, Date.now() + retryDelay),
      )
      .finally(() => {
        running.delete(key);
        if (recent.size > 32) recent.delete(recent.keys().next().value!);
      });
  };
  return {
    prefetch,
    dispose() {
      disposed = true;
      cancel?.();
      pending.clear();
    },
  };
};
