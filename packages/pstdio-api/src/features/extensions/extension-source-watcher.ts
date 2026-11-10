import { readAcceptedRevision, subscribePreparationEvents, withBackgroundPreparation } from "pstdio-extensions";
import {
  createExtensionSourceWatcher as createLocalWatcher,
  type CreateExtensionSourceWatcherInput as LocalWatcherInput,
} from "pstdio-extensions/authoring";
import { withPreparationContinuation } from "pstdio-extensions/preparation-client";
import { runExtensionPreparation } from "./extension-preparation";
import { createPreparationWatchRefresh } from "./preparation-watch-refresh";

export type { ExtensionSourceWatcher } from "pstdio-extensions/authoring";

type InstalledSourceRegistration = Awaited<ReturnType<LocalWatcherInput["listInstalledSources"]>>[number] & {
  source_hash?: string | null;
};

export type CreateExtensionSourceWatcherInput = Omit<LocalWatcherInput, "listInstalledSources"> & {
  listInstalledSources: () => Promise<InstalledSourceRegistration[]>;
  afterSourceChanged?: (sourcePath: string) => Promise<unknown>;
};

export const createExtensionSourceWatcher = async (input: CreateExtensionSourceWatcherInput) => {
  if (input.watch || input.includeIgnoredPath)
    return createLocalWatcher({
      ...input,
      onSourceChanged: async (path) => {
        await input.onSourceChanged(path);
        await input.afterSourceChanged?.(path);
      },
    });
  const id = crypto.randomUUID();
  let disposed = false;
  let registered = false;
  type Change = { started: boolean; origin: "attachment" | "edit"; work: Promise<void> };
  const running = new Map<string, Change>();
  const attachments = new Set<string>();
  // Runtime acceptance intentionally retains A after an observed frontend edit B.
  // Worker replacement must not keep promoting that same B as a new live edit.
  const observedHashes = new Map<string, string | undefined>();
  let attaching: Promise<void> | undefined;
  const updateFrontend = async (path: string, origin: Change["origin"]) => {
    const update = () => withBackgroundPreparation(async () => input.onSourceChanged(path));
    try {
      const accepted = origin === "edit" || (await readAcceptedRevision(path));
      if (accepted)
        await withPreparationContinuation(update, { priority: origin === "edit" ? "requested" : "background" });
      else await update();
      return true;
    } catch (error) {
      input.onError?.(error);
      return false;
    }
  };
  const changed = (path: string, origin: Change["origin"] = "attachment") => {
    if (disposed) return;
    const previous = running.get(path);
    if (previous && !previous.started) {
      if (origin === "edit") previous.origin = origin;
      return previous.work;
    }
    let created: Change;
    const run = async () => {
      let updated = false;
      try {
        if (disposed || !observedHashes.has(path)) return;
        created.started = true;
        updated = await updateFrontend(path, created.origin);
      } finally {
        // Frontend freshness belongs to the manager. Provisioning and disposal
        // still own every earlier generation, even if this frontend fails.
        await previous?.work.catch(() => {});
      }
      if (updated) {
        try {
          await withBackgroundPreparation(async () => input.afterSourceChanged?.(path));
        } catch (error) {
          input.onError?.(error);
        }
      }
    };
    const work = Promise.resolve()
      .then(run)
      .finally(() => {
        if (running.get(path) === created) running.delete(path);
      });
    created = { started: false, origin, work };
    running.set(path, created);
    return work;
  };
  const reconcileAttachment = () => {
    if (disposed || attaching) return;
    const path = attachments.values().next().value;
    if (!path) return;
    attachments.delete(path);
    // Admit one offline check at a time. Ordinary edits can enqueue fresh work
    // without waiting behind every source attached after startup/worker loss.
    attaching = Promise.resolve()
      .then(() => changed(path))
      .finally(() => {
        attaching = undefined;
        reconcileAttachment();
      });
  };
  const observe = (path: string, hash: unknown) => {
    if (typeof hash !== "string") return false;
    const previous = observedHashes.get(path);
    observedHashes.set(path, hash);
    return hash === previous;
  };
  const unsubscribe = subscribePreparationEvents((event) => {
    if (disposed) return;
    if (registered && (event.kind === "worker-ready" || event.kind === "worker-lost")) {
      void withPreparationContinuation(refresh, { priority: "restoration" }).catch((error) => input.onError?.(error));
      return;
    }
    if (event.watchId !== id) return;
    if (typeof event.error === "string") {
      input.onError?.(new Error(event.error));
      return;
    }
    if (typeof event.sourcePath !== "string" || !observedHashes.has(event.sourcePath)) return;
    const repeated = observe(event.sourcePath, event.sourceHash);
    if (event.attachment === true && (event.changed !== true || repeated)) {
      attachments.add(event.sourcePath);
      reconcileAttachment();
    } else {
      attachments.delete(event.sourcePath);
      changed(event.sourcePath, "edit");
    }
  });
  const refreshOwner = createPreparationWatchRefresh(async (sourcePath, signal) => {
    if (disposed) return;
    const rows = (await input.listInstalledSources()).map(({ install_name, source_path, source_hash }) => ({
      install_name,
      source_path,
      source_hash,
    }));
    if (disposed) return;
    const paths = new Set(rows.map((row) => row.source_path));
    for (const path of observedHashes.keys())
      if (!paths.has(path)) {
        observedHashes.delete(path);
        attachments.delete(path);
      }
    for (const path of paths) if (!observedHashes.has(path)) observedHashes.set(path, undefined);
    await runExtensionPreparation(
      "watch.update",
      { id, kind: "sources", rows, sourcePath },
      { priority: "background", signal },
    );
  });
  const refresh = refreshOwner.refresh;
  try {
    await refresh();
    registered = true;
  } catch (error) {
    disposed = true;
    attachments.clear();
    observedHashes.clear();
    unsubscribe();
    await refreshOwner.dispose();
    await Promise.allSettled([...running.values()].map((change) => change.work));
    throw error;
  }
  return {
    refresh,
    dispose: async () => {
      disposed = true;
      attachments.clear();
      observedHashes.clear();
      unsubscribe();
      await refreshOwner.dispose();
      await Promise.allSettled(
        [...running.values()].map((change) => change.work).concat(attaching ?? Promise.resolve()),
      );
      await runExtensionPreparation("watch.dispose", { id }).catch(() => {});
    },
  };
};
