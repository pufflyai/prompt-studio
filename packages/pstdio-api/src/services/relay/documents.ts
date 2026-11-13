import { fetchSyncSpaces } from "pstdio-sync/relay";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import { type ExtensionDocumentSyncInput, initializeDocumentPass } from "./document-pass";
import { documentProgress } from "./document-progress";
import { createSourceActivity } from "./source-activity";

interface SyncInput extends ExtensionDocumentSyncInput {
  beforeDownload?: () => Promise<void>;
}

export const createExtensionDocumentSync = (input: SyncInput) => {
  const activity = createSourceActivity(input.statusChanged);
  let current: Awaited<ReturnType<typeof initializeDocumentPass>> | undefined;
  const stop = input.deps.extensionStorageService.watch((owner) => {
    if (owner.workbenchId !== input.owner.workbenchId || owner.extensionId !== input.owner.extensionId) return;
    if (current) current.invalidate(owner.documentId);
    else input.statusChanged?.();
  });
  let firstDownloaded = false;
  let preparing:
    | {
        signal: AbortSignal;
        work: Promise<Awaited<ReturnType<typeof initializeDocumentPass>>>;
        initialized?: () => void;
      }
    | undefined;
  const starting = new Map<string, { signal: AbortSignal; work: Promise<boolean>; dirty: boolean }>();
  const close = async () => {
    const previous = current;
    current = undefined;
    await previous?.close();
  };
  const synchronizeDocument = (name: string, signal: AbortSignal) => {
    if (name === "records") return Promise.resolve(false);
    const previous = starting.get(name);
    if (previous?.signal === signal) {
      previous.dirty = true;
      return previous.work;
    }
    let request: { signal: AbortSignal; dirty: boolean; work: Promise<boolean> };
    const work = Promise.resolve().then(async () => {
      try {
        while (request.dirty) {
          request.dirty = false;
          const active = await prepare(signal, input.discoveryNeeded);
          await activity.run("internal-document", () => active.synchronizeDocument(name), signal);
          if (current !== active) request.dirty = true;
        }
        return true;
      } finally {
        if (starting.get(name)?.work === work) starting.delete(name);
      }
    });
    request = { signal, dirty: true, work };
    starting.set(name, request);
    return work;
  };
  const prepare = (signal: AbortSignal, initialized?: () => void) => {
    if (preparing?.signal === signal) {
      if (!initialized) preparing.initialized = undefined;
      return preparing.work;
    }
    let request: NonNullable<typeof preparing>;
    const work = Promise.resolve().then(async () => {
      const { config } = input;
      const { project: space } = await activity.run(
        "loading-keys",
        () => fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal }),
        signal,
      );
      if (!current || current.signal !== signal || current.generation !== space.generation) {
        await close();
        signal.throwIfAborted();
        current = await initializeDocumentPass(input, activity, signal, space);
        // A full pass already owns discovery; only targeted preparation schedules it.
        request.initialized?.();
      }
      return current;
    });
    request = { signal, work, initialized };
    preparing = request;
    void work
      .finally(() => {
        if (preparing?.work === work) preparing = undefined;
      })
      .catch(() => {});
    return work;
  };
  return {
    async close() {
      stop();
      await close();
      activity.close();
    },
    status: async () => ({
      firstDownloaded,
      ...((await current?.status()) ?? documentProgress([undefined, undefined], false)),
      ...activity.status(),
    }),
    synchronizeDocument,
    prepare: (signal: AbortSignal) => prepare(signal),
    hasDocument: (name: string) => !!current?.jobs.has(name),
    acceptsChange(change: Extract<LiveServerMessage, { type: "changed" | "discovered" }>) {
      const active = current;
      return (
        change.spaceOwner === null &&
        !!active &&
        (change.documentId === active.ownerId ||
          change.documentId === active.recordStreamId ||
          active.logs.has(change.documentId) ||
          active.jobs.nameFor(change.documentId) !== undefined)
      );
    },
    synchronizeChanged(change: Extract<LiveServerMessage, { type: "changed" | "discovered" }>, signal: AbortSignal) {
      if (change.spaceOwner !== null) return Promise.resolve(true);
      const active = current;
      if (!active || active.signal !== signal) return Promise.resolve(false);
      if (change.documentId === active.ownerId || change.documentId === active.recordStreamId)
        return Promise.resolve(false);
      if (active.logs.changed(change.documentId)) return Promise.resolve(true);
      const name = active.jobs.nameFor(change.documentId);
      // Owner directory publication announces new names. Reconnect also reads that directory.
      // An opaque hint belonging to another owner must not sweep this owner.
      return name ? synchronizeDocument(name, signal) : Promise.resolve(true);
    },
    async synchronize(signal: AbortSignal) {
      let active = await prepare(signal);
      // File projection belongs to this prepared pass. Preparing a second time
      // afterward needlessly fetches and decrypts the same key generation again.
      await input.beforeDownload?.();
      signal.throwIfAborted();
      if (current !== active) active = await prepare(signal);
      await active.synchronize();
      if (current === active && (await active.status()).downloaded) firstDownloaded = true;
    },
  };
};
