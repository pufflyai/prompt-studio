import { extensionTransportName } from "pstdio-api-contracts/extension-host";
import type { SubscribeDocument } from "pstdio-sync/relay";
import { createDocumentRelay, createDocumentSync, createRecordStreamSync, fetchSyncSpaces } from "pstdio-sync/relay";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createRelayDocumentJobs, RelayDocumentRetiredError } from "./document-jobs";
import { documentProgress } from "./document-progress";
import { createRelayLogs } from "./logs";
import { createSyncQuarantine } from "./quarantine";
import { traceDocumentProgress, traceDocumentSync, traceRecordStreamStore } from "./record-stream-progress";
import type { RelayWorkbench } from "./runtime";

interface ExtensionDocumentSyncInput {
  config: RelayWorkbench;
  owner: { workbenchId: string; extensionId: string };
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  discoveryNeeded?: () => void;
  subscribe?: SubscribeDocument;
  statusChanged?: () => void;
}

const initializeDocuments = async (
  input: ExtensionDocumentSyncInput,
  signal: AbortSignal,
  space: Awaited<ReturnType<typeof fetchSyncSpaces>>["project"],
) => {
  const { config, owner, deps } = input;
  const controller = new AbortController();
  const workSignal = AbortSignal.any([signal, controller.signal]);
  const relay = (documentId: string) =>
    createDocumentRelay({
      subscribe: input.subscribe,
      origin: config.relayOrigin,
      space,
      documentId,
      signal: workSignal,
      token: async () => (await input.access()).token,
    });
  const quarantine = (documentId: string) =>
    createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId });
  const ownerId = await space.documentId(extensionTransportName(owner.extensionId, "owner"));
  const recordStreamId = await space.documentId(extensionTransportName(owner.extensionId, "record-stream-v2"));
  let observation: Promise<ReturnType<typeof documentProgress>> | undefined;
  const statusChanged = () => {
    observation = undefined;
    input.statusChanged?.();
  };
  const logs = createRelayLogs({
    owner,
    space,
    service: deps.extensionStorageService.logs,
    relay,
    signal: workSignal,
    subscribe: input.subscribe,
    statusChanged,
  });
  const jobs = createRelayDocumentJobs({
    signal: workSignal,
    create: async (name) => {
      const documentId =
        name === "records" ? ownerId : await space.documentId(extensionTransportName(owner.extensionId, name));
      const sync = createDocumentSync({
        owner,
        space,
        documentId,
        store: deps.extensionStorageService.documents.open(name),
        assets: createRecordAssets(deps.assetTransferService, owner, workSignal),
        relay: relay(documentId),
        quarantine: quarantine(documentId),
      });
      return { documentId, sync: traceDocumentSync(owner, name === "records" ? "directory" : "document", sync) };
    },
  });
  const records = createRecordStreamSync({
    space,
    documentId: recordStreamId,
    relay: relay(recordStreamId),
    store: traceRecordStreamStore(owner, deps.extensionStorageService.documents.recordStream(owner)),
    assets: createRecordAssets(deps.assetTransferService, owner, workSignal),
    quarantine: quarantine(recordStreamId),
  });
  let directory: string[] | undefined;
  let running: Promise<void> | undefined;
  const synchronizeDocument = async (name: string) => {
    statusChanged();
    try {
      return await jobs.synchronize(name);
    } finally {
      statusChanged();
    }
  };
  const synchronize = () => {
    if (running) return running;
    const work = Promise.resolve().then(async () => {
      try {
        directory = undefined;
        statusChanged();
        workSignal.throwIfAborted();
        await deps.extensionStorageService.documents.list(owner);
        workSignal.throwIfAborted();
        await synchronizeDocument("records");
        workSignal.throwIfAborted();
        await records.synchronize();
        await logs.publish();
        workSignal.throwIfAborted();
        directory = await deps.extensionStorageService.documents.list(owner);
        statusChanged();
        for (const name of directory) {
          workSignal.throwIfAborted();
          if (name !== "records") {
            await synchronizeDocument(name);
          }
        }
      } catch (error) {
        if (error !== workSignal.reason || !(error instanceof RelayDocumentRetiredError)) throw error;
      } finally {
        running = undefined;
      }
    });
    running = work;
    return work;
  };
  return {
    signal,
    generation: space.generation,
    jobs,
    logs,
    ownerId,
    recordStreamId,
    synchronizeDocument,
    invalidate(name?: string) {
      if (name && !directory?.includes(name)) directory = undefined;
      statusChanged();
    },
    // Storage commits and transport progress invalidate this owner's snapshot.
    // Unrelated owners can then report progress without rereading its database rows.
    status: () =>
      (observation ??= readStatus().catch((error) => {
        observation = undefined;
        throw error;
      })),
    synchronize,
    async close() {
      controller.abort(new RelayDocumentRetiredError("Document key generation retired"));
      await running?.catch(() => {});
      await jobs.close();
      await logs.close();
    },
  };
  async function readStatus() {
    const names = [...new Set(["records", ...jobs.names(), ...(directory ?? [])])];
    const statuses = [...(await jobs.statuses(names)), await records.status(), await logs.status()];
    traceDocumentProgress(owner, names, statuses);
    return documentProgress(statuses, directory !== undefined);
  }
};

export const createExtensionDocumentSync = (input: ExtensionDocumentSyncInput) => {
  let current: Awaited<ReturnType<typeof initializeDocuments>> | undefined;
  const stop = input.deps.extensionStorageService.watch((owner) => {
    if (owner.workbenchId !== input.owner.workbenchId || owner.extensionId !== input.owner.extensionId) return;
    if (current) current.invalidate(owner.documentId);
    else input.statusChanged?.();
  });
  let firstDownloaded = false;
  let preparing:
    | { signal: AbortSignal; work: Promise<Awaited<ReturnType<typeof initializeDocuments>>>; initialized?: () => void }
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
          await active.synchronizeDocument(name);
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
      const { project: space } = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal });
      if (!current || current.signal !== signal || current.generation !== space.generation) {
        await close();
        signal.throwIfAborted();
        current = await initializeDocuments(input, signal, space);
        // A targeted download needs the owner's directory too. A full pass already
        // owns discovery, so its preparation must not schedule another sweep.
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
    },
    status: async () => ({
      firstDownloaded,
      ...((await current?.status()) ?? documentProgress([undefined, undefined], false)),
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
      const active = await prepare(signal);
      await active.synchronize();
      if (current === active && (await active.status()).downloaded) firstDownloaded = true;
    },
  };
};
